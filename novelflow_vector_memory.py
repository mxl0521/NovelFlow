from __future__ import annotations

import hashlib
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any


_CLIENT = None
_EMBEDDING = None


def _enabled() -> bool:
    return os.getenv("NOVELFLOW_VECTOR_MEMORY", "1").strip().lower() not in {"0", "false", "off"}


def _collection_name(project_id: str) -> str:
    digest = hashlib.sha256(project_id.encode("utf-8")).hexdigest()[:24]
    return f"novelflow_{digest}"


def _runtime(root: Path):
    global _CLIENT, _EMBEDDING
    if _CLIENT is None or _EMBEDDING is None:
        import chromadb
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
        from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2

        vector_root = root / ".novelflow-vectors"
        model_root = root / ".novelflow-models" / "all-MiniLM-L6-v2"
        vector_root.mkdir(parents=True, exist_ok=True)
        model_root.parent.mkdir(parents=True, exist_ok=True)
        # Chroma defaults to the user's home cache, which may be read-only in a
        # packaged/local deployment. Keep both data and model files with the app.
        ONNXMiniLM_L6_V2.DOWNLOAD_PATH = str(model_root)
        _CLIENT = chromadb.PersistentClient(path=str(vector_root))
        _EMBEDDING = DefaultEmbeddingFunction()
    return _CLIENT, _EMBEDDING


def search_semantic_chunks(database_path: Path, project_id: str, query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Index changed SQLite chunks locally and return neural semantic matches."""
    if not _enabled() or not project_id or not query.strip():
        return []
    try:
        with sqlite3.connect(database_path, timeout=10) as db:
            db.row_factory = sqlite3.Row
            rows = db.execute(
                "SELECT chapter_id, chunk_index, title, content, updated_at FROM memory_chunks WHERE project_id=? ORDER BY chapter_id, chunk_index",
                (project_id,),
            ).fetchall()
        if not rows:
            return []
        client, embedding = _runtime(database_path.parent)
        name = _collection_name(project_id)
        collection = client.get_or_create_collection(name=name, embedding_function=embedding, metadata={"projectId": project_id})
        latest = max(str(row["updated_at"]) for row in rows)
        if collection.metadata.get("updatedAt") != latest or collection.count() != len(rows):
            ids = [f"{project_id}:{row['chapter_id']}:{row['chunk_index']}" for row in rows]
            collection.upsert(
                ids=ids,
                documents=[str(row["content"]) for row in rows],
                metadatas=[{"chapterId": str(row["chapter_id"]), "chunkIndex": int(row["chunk_index"]), "title": str(row["title"])} for row in rows],
            )
            collection.modify(metadata={"projectId": project_id, "updatedAt": latest})
        amount = max(1, min(limit, collection.count(), 30))
        found = collection.query(query_texts=[query[:500]], n_results=amount, include=["documents", "metadatas", "distances"])
        documents = found.get("documents", [[]])[0]
        metadatas = found.get("metadatas", [[]])[0]
        distances = found.get("distances", [[]])[0]
        results = []
        for document, metadata, distance in zip(documents, metadatas, distances):
            score = 1.0 / (1.0 + max(0.0, float(distance)))
            results.append({
                "type": "语义记忆",
                "title": f"第 {metadata.get('chapterId', '')} 章 · {metadata.get('title', '')}",
                "chapterId": str(metadata.get("chapterId", "")),
                "chunkIndex": int(metadata.get("chunkIndex", 0)),
                "content": str(document),
                "score": round(score * 20, 3),
                "match": {"embedding": round(score, 4)},
                "evidence": {"type": "语义记忆", "title": str(metadata.get("title", "")), "quote": str(document)[:500]},
            })
        return results
    except Exception as exc:
        logging.warning("local vector memory unavailable: %s: %s", type(exc).__name__, exc)
        return []
