"""Cloud snapshot/index contracts with a fake PostgREST service; no credentials."""
import copy
import unittest
from unittest.mock import patch

import httpx

import novelflow_cloud as cloud


class CloudSaveTests(unittest.TestCase):
    def setUp(self):
        self.row = None
        self.chunks = []
        self.calls = []
        self.fail_chunks = False
        self.project = {"id": "book", "title": "作品", "updated_at": "2026-10-23T00:00:00Z",
                        "chapters": [{"id": "01", "body": "旧线索"}, {"id": "02", "body": "第二章"}], "memory": {}}
        self.ready = patch.object(cloud, "ready", return_value=True)
        self.request = patch.object(cloud, "_request", side_effect=self.service)
        self.ready.start()
        self.request.start()
        self.addCleanup(self.ready.stop)
        self.addCleanup(self.request.stop)

    def service(self, method, table, **kwargs):
        self.calls.append((method, table, copy.deepcopy(kwargs)))
        params = kwargs.get("params", {})
        if table == "novelflow_projects":
            if method == "GET":
                result = [copy.deepcopy(self.row)] if self.row else []
            elif method == "PATCH" and (not self.row or params["updated_at"] != f"eq.{self.row['updated_at']}"):
                result = []
            else:
                self.row = copy.deepcopy(kwargs["json"])
                result = [copy.deepcopy(self.row)]
        elif method == "DELETE":
            chapter_id = params.get("chapter_id", "").removeprefix("eq.")
            self.chunks = [r for r in self.chunks if chapter_id and r["chapter_id"] != chapter_id]
            result = []
        else:
            if self.fail_chunks:
                raise TimeoutError("fake index outage")
            self.chunks.extend(copy.deepcopy(kwargs["json"]))
            result = []
        return httpx.Response(200, json=result)

    def test_only_changed_chapter_is_reindexed_and_checkpoint_is_durable(self):
        cloud.save_project(self.project)
        previous = copy.deepcopy(self.row["data"])
        self.project["chapters"][1]["body"] = "新的正文"
        self.project["updated_at"] = "2026-10-23T00:01:00Z"
        self.calls.clear()
        cloud.save_project(self.project, previous)
        deleted = [kwargs["params"].get("chapter_id") for method, table, kwargs in self.calls
                   if method == "DELETE" and table == "novelflow_memory_chunks"]
        self.assertEqual(deleted, ["eq.02"])
        self.assertEqual([c["content"] for c in self.chunks], ["旧线索", "新的正文"])
        self.assertEqual(self.row["data"]["_memory_index"], self.project["_memory_index"])

    def test_concurrent_snapshot_conflict_does_not_overwrite_prose_or_index(self):
        cloud.save_project(self.project)
        previous = copy.deepcopy(self.row["data"])
        self.row["updated_at"] = "2026-10-23T00:02:00Z"
        self.row["data"]["chapters"][0]["body"] = "另一请求已保存"
        chunks_before = copy.deepcopy(self.chunks)
        self.project["updated_at"] = "2026-10-23T00:03:00Z"
        with self.assertRaises(cloud.CloudConflictError):
            cloud.save_project(self.project, previous)
        self.assertEqual(self.row["data"]["chapters"][0]["body"], "另一请求已保存")
        self.assertEqual(self.chunks, chunks_before)

    def test_failed_index_write_is_repaired_on_next_save(self):
        cloud.save_project(self.project)
        previous = copy.deepcopy(self.row["data"])
        self.project["chapters"][0]["body"] = "已保存但索引待修复"
        self.project["updated_at"] = "2026-10-23T00:01:00Z"
        self.fail_chunks = True
        with self.assertRaises(TimeoutError):
            cloud.save_project(self.project, previous)
        self.assertEqual(self.row["data"]["chapters"][0]["body"], "已保存但索引待修复")
        self.assertEqual(self.row["data"]["_memory_index"], previous["_memory_index"])
        loaded = copy.deepcopy(self.row["data"])
        self.fail_chunks = False
        cloud.save_project(loaded, copy.deepcopy(loaded))
        self.assertIn("已保存但索引待修复", [c["content"] for c in self.chunks])
        self.assertEqual(len(self.chunks), 2)


if __name__ == "__main__":
    unittest.main()
