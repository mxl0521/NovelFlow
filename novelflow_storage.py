"""SQLite persistence, rotating backups, trash and exports for NovelFlow."""

from __future__ import annotations

import json
import math
import re
import sqlite3
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import novelflow_cloud


ROOT = Path(__file__).resolve().parent
DATABASE_PATH = ROOT / "novelflow.db"
BACKUP_DIR = ROOT / "backup" / "novelflow"
SCHEMA_VERSION = 2


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=30000")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at, updated_at);
        CREATE TABLE IF NOT EXISTS memory_chunks (
            project_id TEXT NOT NULL,
            chapter_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(project_id, chapter_id, chunk_index)
        );
        CREATE INDEX IF NOT EXISTS idx_memory_chunks_project ON memory_chunks(project_id, chapter_id);
        """
    )
    # Schema metadata is initialized with an explicit commit. Leaving this
    # write transaction open makes a second local process fail with
    # `database is locked` while the app is starting.
    connection.execute("INSERT OR REPLACE INTO app_meta(key, value) VALUES('schema_version', ?)", (str(SCHEMA_VERSION),))
    connection.commit()
    return connection


def load_registry(fallback: dict[str, Any]) -> dict[str, Any]:
    """Load active projects, importing the existing JSON registry once."""
    if novelflow_cloud.ready():
        try:
            return novelflow_cloud.load_registry(fallback)
        except Exception:
            # A transient cloud outage must not make the local editor unusable.
            pass
    with closing(_connect()) as connection:
        count = int(connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0])
        if count == 0:
            save_registry(fallback, connection=connection)
        rows = connection.execute("SELECT data_json FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC").fetchall()
        projects = [json.loads(row["data_json"]) for row in rows]
        active_row = connection.execute("SELECT value FROM app_meta WHERE key='active_project_id'").fetchone()
        active_id = active_row["value"] if active_row else ""
        if projects and active_id not in {item.get("id") for item in projects}:
            active_id = str(projects[0].get("id", ""))
        return {"active_id": active_id, "projects": projects} if projects else fallback


def save_registry(registry: dict[str, Any], connection: sqlite3.Connection | None = None) -> None:
    if connection is None and novelflow_cloud.ready():
        try:
            novelflow_cloud.save_registry(registry)
        except Exception:
            pass
    owns_connection = connection is None
    db = connection or _connect()
    now = datetime.now(timezone.utc).isoformat()
    try:
        for project in registry.get("projects", []):
            if not isinstance(project, dict) or not project.get("id"):
                continue
            updated = str(project.get("updated_at") or now)
            db.execute(
                """INSERT INTO projects(id, title, data_json, updated_at, deleted_at)
                   VALUES(?, ?, ?, ?, NULL)
                   ON CONFLICT(id) DO UPDATE SET title=excluded.title, data_json=excluded.data_json,
                   updated_at=excluded.updated_at, deleted_at=NULL""",
                (str(project["id"]), str(project.get("title", "未命名作品")), json.dumps(project, ensure_ascii=False), updated),
            )
            _index_project_memory(db, project, updated)
        db.execute("INSERT OR REPLACE INTO app_meta(key, value) VALUES('active_project_id', ?)", (str(registry.get("active_id", "")),))
        db.commit()
    finally:
        if owns_connection:
            db.close()


def _split_chapter_text(text: str, max_chars: int = 1_000) -> list[str]:
    """Split a chapter into bounded, overlapping local retrieval chunks."""
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


def _index_project_memory(connection: sqlite3.Connection, project: dict[str, Any], updated_at: str) -> None:
    project_id = str(project.get("id", ""))
    if not project_id:
        return
    connection.execute("DELETE FROM memory_chunks WHERE project_id=?", (project_id,))
    for chapter in project.get("chapters", []):
        if not isinstance(chapter, dict):
            continue
        chapter_id = str(chapter.get("id", ""))
        title = str(chapter.get("title", "未命名章节"))[:120]
        for index, content in enumerate(_split_chapter_text(str(chapter.get("body", "")))):
            connection.execute(
                "INSERT INTO memory_chunks(project_id, chapter_id, chunk_index, title, content, updated_at) VALUES(?, ?, ?, ?, ?, ?)",
                (project_id, chapter_id, index, title, content, updated_at),
            )


def _ngrams(text: str) -> Counter[str]:
    cleaned = re.sub(r"\s+", "", text.lower())
    return Counter(cleaned[index:index + 2] for index in range(max(0, len(cleaned) - 1)))


def _cosine(left: Counter[str], right: Counter[str]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(value * right.get(key, 0) for key, value in left.items())
    norm_left = math.sqrt(sum(value * value for value in left.values()))
    norm_right = math.sqrt(sum(value * value for value in right.values()))
    return dot / (norm_left * norm_right) if norm_left and norm_right else 0.0


def search_memory_chunks(project_id: str, query: str, limit: int = 12) -> list[dict[str, Any]]:
    """Return local keyword + character n-gram semantic-approximation matches."""
    if novelflow_cloud.ready():
        try:
            return novelflow_cloud.search_memory_chunks(project_id, query, limit)
        except Exception:
            pass
    query = query.strip()[:500]
    if not query:
        return []
    query_chars = {char for char in query if not char.isspace() and char not in "，。！？、：；（）【】"}
    query_vector = _ngrams(query)
    with closing(_connect()) as connection:
        rows = connection.execute(
            "SELECT chapter_id, chunk_index, title, content FROM memory_chunks WHERE project_id=?",
            (project_id,),
        ).fetchall()
    results = []
    for row in rows:
        text = f"{row['title']} {row['content']}"
        keyword = (1.0 if query in text else 0.0) + (len(query_chars.intersection(set(text))) / max(1, len(query_chars)))
        semantic = _cosine(query_vector, _ngrams(text))
        score = keyword * 0.55 + semantic * 0.45
        if score <= 0.08:
            continue
        results.append({
            "type": "正文片段",
            "title": f"第 {row['chapter_id']} 章 · {row['title']}",
            "chapterId": row["chapter_id"],
            "chunkIndex": row["chunk_index"],
            "content": row["content"],
            "score": round(score, 4),
            "match": {"keyword": round(keyword, 4), "semanticApprox": round(semantic, 4)},
            "evidence": {"type": "正文片段", "title": f"第 {row['chapter_id']} 章 · {row['title']}", "quote": row["content"][:500]},
        })
    return sorted(results, key=lambda item: item["score"], reverse=True)[:max(1, min(limit, 30))]


def soft_delete_project(project_id: str) -> None:
    if novelflow_cloud.ready():
        try:
            novelflow_cloud.soft_delete_project(project_id)
        except Exception:
            pass
    with closing(_connect()) as connection:
        connection.execute("UPDATE projects SET deleted_at=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), project_id))
        connection.commit()


def deleted_projects() -> list[dict[str, Any]]:
    if novelflow_cloud.ready():
        try:
            return novelflow_cloud.deleted_projects()
        except Exception:
            pass
    with closing(_connect()) as connection:
        rows = connection.execute("SELECT id, title, updated_at, deleted_at FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").fetchall()
        return [dict(row) for row in rows]


def restore_project(project_id: str) -> dict[str, Any] | None:
    if novelflow_cloud.ready():
        try:
            return novelflow_cloud.restore_project(project_id)
        except Exception:
            pass
    with closing(_connect()) as connection:
        row = connection.execute("SELECT data_json FROM projects WHERE id=? AND deleted_at IS NOT NULL", (project_id,)).fetchone()
        if row is None:
            return None
        connection.execute("UPDATE projects SET deleted_at=NULL WHERE id=?", (project_id,))
        connection.commit()
        return json.loads(row["data_json"])


def export_project(project_id: str) -> dict[str, Any] | None:
    if novelflow_cloud.ready():
        try:
            return novelflow_cloud.export_project(project_id)
        except Exception:
            pass
    with closing(_connect()) as connection:
        row = connection.execute("SELECT data_json FROM projects WHERE id=?", (project_id,)).fetchone()
        return json.loads(row["data_json"]) if row else None


def backup_database() -> Path | None:
    """Create at most one backup per UTC day and retain the newest ten."""
    if not DATABASE_PATH.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    existing = sorted(BACKUP_DIR.glob(f"novelflow-{day}-*.db"))
    if existing:
        return existing[-1]
    target = BACKUP_DIR / f"novelflow-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.db"
    source = _connect()
    destination = sqlite3.connect(target)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()
    for stale in sorted(BACKUP_DIR.glob("novelflow-*.db"), reverse=True)[10:]:
        stale.unlink(missing_ok=True)
    return target
