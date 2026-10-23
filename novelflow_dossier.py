"""Pure planning for resumable story dossiers; no network or persistence."""
from __future__ import annotations

import hashlib
import json
from typing import Any

SCHEMA_VERSION = 2
BATCH_CHARS = 12_000
SEGMENT_CHARS = 6_000


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def written_chapters(project: dict[str, Any]) -> list[dict[str, Any]]:
    chapters = [c for c in project.get("chapters", []) if isinstance(c, dict) and str(c.get("body", "")).strip()]
    return sorted(chapters, key=lambda c: (int(c["id"]) if str(c.get("id", "")).isdigit() else float("inf"), str(c.get("id", ""))))


def segments(project: dict[str, Any]) -> list[dict[str, Any]]:
    memory = project.get("memory") or {}
    summaries = memory.get("chapter_summaries") or {}
    result = []
    for chapter in written_chapters(project):
        body = str(chapter["body"])
        count = (len(body) + SEGMENT_CHARS - 1) // SEGMENT_CHARS
        for index in range(count):
            item = {"id": str(chapter["id"]), "title": str(chapter.get("title", "")),
                    "summary": str(summaries.get(str(chapter["id"]), ""))[:1000],
                    "bodyExcerpt": body[index * SEGMENT_CHARS:(index + 1) * SEGMENT_CHARS],
                    "part": index + 1, "parts": count}
            result.append({**item, "signature": digest(item)})
    return result


def plan(project: dict[str, Any]) -> dict[str, Any]:
    items = segments(project)
    signatures = [item["signature"] for item in items]
    memory = project.get("memory") or {}
    meta = memory.get("story_dossier_meta") or {}
    processed = meta.get("processedSegments", [])
    reusable = (meta.get("schemaVersion") == SCHEMA_VERSION and isinstance(processed, list)
                and signatures[:len(processed)] == processed and bool(memory.get("story_dossier")))
    start = len(processed) if reusable else 0
    end, chars = start, 0
    while end < len(items):
        size = len(items[end]["bodyExcerpt"])
        if end > start and chars + size > BATCH_CHARS:
            break
        chars += size
        end += 1
    completed_ids = [item["id"] for item in items[:end] if item["part"] == item["parts"]]
    return {"chapters": [{k: v for k, v in item.items() if k != "signature"} for item in items[start:end]],
            "previousDossier": memory.get("story_dossier", {}) if reusable else {},
            "processedSegments": signatures[:end], "sourceChapterIds": completed_ids,
            "updatedThroughChapter": completed_ids[-1] if completed_ids else "",
            "unchanged": bool(items) and start == len(items), "pending": end < len(items),
            "sourceFingerprint": digest(signatures), "totalSegments": len(items)}


def source_fingerprint(project: dict[str, Any]) -> str:
    return digest([item["signature"] for item in segments(project)])
