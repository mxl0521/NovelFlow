"""Small Supabase PostgREST adapter used by the optional cloud storage mode.

This module deliberately uses the server-side service key only. It stores
project snapshots, memory chunks and per-user model profiles behind
owner-scoped queries so the browser never receives the service credential.
"""

from __future__ import annotations

import math
import os
import re
import json
from datetime import datetime, timezone
from contextvars import ContextVar
from typing import Any

import httpx

from novelflow_secrets import open_secret, seal_secret

_OWNER_ID: ContextVar[str] = ContextVar("novelflow_owner_id", default="")


def enabled() -> bool:
    return bool(os.getenv("SUPABASE_URL", "").strip() and os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip())


def require_auth() -> bool:
    raw = os.getenv("NOVELFLOW_REQUIRE_AUTH", "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def set_owner_id(value: str) -> object:
    return _OWNER_ID.set(value.strip())


def reset_owner_id(token: object) -> None:
    try:
        _OWNER_ID.reset(token)
    except Exception:
        _OWNER_ID.set("")


def owner_id() -> str:
    current = _OWNER_ID.get().strip()
    if current:
        return current
    if require_auth():
        return ""
    return os.getenv("NOVELFLOW_TENANT_ID", "").strip()


def ready() -> bool:
    return enabled() and bool(owner_id())


def _request(method: str, table: str, **kwargs: Any) -> httpx.Response:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates",
    }
    response = httpx.request(method, f"{base}/rest/v1/{table}", headers=headers, timeout=20, **kwargs)
    response.raise_for_status()
    return response


def _split_chapter_text(text: str, max_chars: int = 1_000) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for start in range(0, len(paragraph), max_chars - 150):
                chunks.append(paragraph[start:start + max_chars])
            continue
        candidate = f"{current}\n\n{paragraph}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = paragraph
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _ngrams(text: str) -> dict[str, int]:
    cleaned = re.sub(r"\s+", "", text.lower())
    counts: dict[str, int] = {}
    for index in range(max(0, len(cleaned) - 1)):
        gram = cleaned[index:index + 2]
        counts[gram] = counts.get(gram, 0) + 1
    return counts


def _cosine(left: dict[str, int], right: dict[str, int]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(value * right.get(key, 0) for key, value in left.items())
    norm_left = math.sqrt(sum(value * value for value in left.values()))
    norm_right = math.sqrt(sum(value * value for value in right.values()))
    return dot / (norm_left * norm_right) if norm_left and norm_right else 0.0


def load_registry(fallback: dict[str, Any]) -> dict[str, Any]:
    if not ready():
        return fallback
    rows = _request("GET", "novelflow_projects", params={
        "owner_id": f"eq.{owner_id()}",
        "deleted_at": "is.null",
        "select": "id,data,updated_at",
        "order": "updated_at.desc",
    }).json()
    projects = [row.get("data") for row in rows if isinstance(row, dict) and isinstance(row.get("data"), dict)]
    if not projects:
        return fallback
    active_id = str(fallback.get("active_id", ""))
    if active_id not in {str(item.get("id", "")) for item in projects}:
        active_id = str(projects[0].get("id", ""))
    return {"active_id": active_id, "projects": projects}


def save_registry(registry: dict[str, Any]) -> None:
    if not ready():
        return
    now = datetime.now(timezone.utc).isoformat()
    for project in registry.get("projects", []):
        if not isinstance(project, dict) or not project.get("id"):
            continue
        payload = {
            "id": str(project["id"]),
            "owner_id": owner_id(),
            "title": str(project.get("title", "未命名作品")),
            "data": project,
            "updated_at": str(project.get("updated_at") or now),
            "deleted_at": None,
        }
        _request("POST", "novelflow_projects", params={"on_conflict": "id"}, json=payload)
        _request("DELETE", "novelflow_memory_chunks", params={"project_id": f"eq.{payload['id']}", "owner_id": f"eq.{owner_id()}"})
        for chapter in project.get("chapters", []):
            if not isinstance(chapter, dict):
                continue
            chapter_id = str(chapter.get("id", ""))
            title = str(chapter.get("title", "未命名章节"))[:120]
            for index, content in enumerate(_split_chapter_text(str(chapter.get("body", "")))):
                _request("POST", "novelflow_memory_chunks", json={
                    "owner_id": owner_id(),
                    "project_id": payload["id"],
                    "chapter_id": chapter_id,
                    "chunk_index": index,
                    "title": title,
                    "content": content,
                    "updated_at": now,
                })


def load_model_profiles() -> list[dict[str, Any]]:
    if not ready():
        return []
    rows = _request("GET", "novelflow_model_profiles", params={
        "owner_id": f"eq.{owner_id()}",
        "select": "id,name,provider,model,api_key,base_url,protocol,api_mode,extra_headers,updated_at",
        "order": "updated_at.desc",
    }).json()
    profiles: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        extra_headers = row.get("extra_headers", {})
        if not isinstance(extra_headers, dict):
            extra_headers = {}
        profiles.append({
            "id": str(row.get("id", "")),
            "name": str(row.get("name", "")),
            "provider": str(row.get("provider", "")),
            "model": str(row.get("model", "")),
            "key_env": "",
            "base_url": row.get("base_url") or None,
            "protocol": str(row.get("protocol", "openai")),
            "api_mode": str(row.get("api_mode", "chat")),
            "extra_headers": extra_headers,
            "api_key": open_secret(str(row.get("api_key", ""))),
            "managed": True,
        })
    return profiles


def save_model_profiles(profiles: list[dict[str, Any]]) -> None:
    if not ready():
        return
    now = datetime.now(timezone.utc).isoformat()
    _request("DELETE", "novelflow_model_profiles", params={"owner_id": f"eq.{owner_id()}"})
    for profile in profiles:
        if not isinstance(profile, dict) or not profile.get("id"):
            continue
        payload = {
            "owner_id": owner_id(),
            "id": str(profile.get("id", "")),
            "name": str(profile.get("name", "未命名模型"))[:80],
            "provider": str(profile.get("provider", "OpenAI 兼容接口"))[:60],
            "model": str(profile.get("model", ""))[:120],
            "api_key": seal_secret(str(profile.get("api_key", ""))),
            "base_url": str(profile.get("base_url") or "").strip() or None,
            "protocol": str(profile.get("protocol", "openai")).strip().lower() or "openai",
            "api_mode": str(profile.get("api_mode", "chat")).strip().lower() or "chat",
            "extra_headers": profile.get("extra_headers", {}) if isinstance(profile.get("extra_headers", {}), dict) else {},
            "updated_at": str(profile.get("updated_at") or now),
        }
        _request("POST", "novelflow_model_profiles", params={"on_conflict": "owner_id,id"}, json=payload)


def deleted_projects() -> list[dict[str, Any]]:
    if not ready():
        return []
    rows = _request("GET", "novelflow_projects", params={
        "owner_id": f"eq.{owner_id()}", "deleted_at": "not.is.null",
        "select": "id,title,updated_at,deleted_at", "order": "deleted_at.desc",
    }).json()
    return [row for row in rows if isinstance(row, dict)]


def soft_delete_project(project_id: str) -> None:
    if ready():
        _request("PATCH", "novelflow_projects", params={"id": f"eq.{project_id}", "owner_id": f"eq.{owner_id()}"}, json={"deleted_at": datetime.now(timezone.utc).isoformat()})


def restore_project(project_id: str) -> dict[str, Any] | None:
    if not ready():
        return None
    rows = _request("PATCH", "novelflow_projects", params={"id": f"eq.{project_id}", "owner_id": f"eq.{owner_id()}"}, json={"deleted_at": None}).json()
    return rows[0].get("data") if rows and isinstance(rows[0], dict) else None


def export_project(project_id: str) -> dict[str, Any] | None:
    if not ready():
        return None
    rows = _request("GET", "novelflow_projects", params={"id": f"eq.{project_id}", "owner_id": f"eq.{owner_id()}", "select": "data"}).json()
    return rows[0].get("data") if rows and isinstance(rows[0], dict) else None


def search_memory_chunks(project_id: str, query: str, limit: int = 12) -> list[dict[str, Any]]:
    query = query.strip()[:500]
    if not query:
        return []
    rows = _request("GET", "novelflow_memory_chunks", params={
        "project_id": f"eq.{project_id}",
        "owner_id": f"eq.{owner_id()}",
        "select": "chapter_id,chunk_index,title,content",
    }).json()
    query_chars = {char for char in query if not char.isspace() and char not in "，。！？、：；（）【】"}
    query_vector = _ngrams(query)
    results = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        text = f"{row.get('title', '')} {row.get('content', '')}"
        keyword = (1.0 if query in text else 0.0) + (len(query_chars.intersection(set(text))) / max(1, len(query_chars)))
        semantic = _cosine(query_vector, _ngrams(text))
        score = keyword * 0.55 + semantic * 0.45
        if score <= 0.08:
            continue
        results.append({
            "type": "正文片段",
            "title": f"第 {row.get('chapter_id', '')} 章 · {row.get('title', '')}",
            "chapterId": row.get("chapter_id", ""),
            "chunkIndex": row.get("chunk_index", 0),
            "content": row.get("content", ""),
            "score": round(score, 4),
            "match": {"keyword": round(keyword, 4), "semanticApprox": round(semantic, 4)},
            "evidence": {"type": "正文片段", "title": f"第 {row.get('chapter_id', '')} 章 · {row.get('title', '')}", "quote": str(row.get('content', ''))[:500]},
        })
    return sorted(results, key=lambda item: item["score"], reverse=True)[:max(1, min(limit, 30))]
