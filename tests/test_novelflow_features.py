import tempfile
import unittest
from pathlib import Path

import agent_skills
import novelflow_storage as storage


class NovelFlowStorageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.old_database = storage.DATABASE_PATH
        self.old_backup = storage.BACKUP_DIR
        storage.DATABASE_PATH = Path(self.temporary.name) / "novelflow.db"
        storage.BACKUP_DIR = Path(self.temporary.name) / "backup"
        self.project = {
            "id": "project-test",
            "title": "测试作品",
            "updated_at": "2026-08-08T00:00:00+00:00",
            "chapters": [
                {"id": "01", "title": "长章", "body": "开头线索。\n\n" + ("普通段落内容。" * 180) + "\n\n中段独有玉佩暗纹证据。\n\n" + ("结尾段落内容。" * 180)},
            ],
            "memory": {},
        }

    def tearDown(self):
        storage.DATABASE_PATH = self.old_database
        storage.BACKUP_DIR = self.old_backup
        self.temporary.cleanup()

    def test_json_registry_migrates_and_exports(self):
        registry = {"active_id": self.project["id"], "projects": [self.project]}
        loaded = storage.load_registry(registry)
        self.assertEqual(loaded["active_id"], self.project["id"])
        self.assertEqual(storage.export_project(self.project["id"])["title"], "测试作品")

    def test_soft_delete_and_restore(self):
        storage.save_registry({"active_id": self.project["id"], "projects": [self.project]})
        storage.soft_delete_project(self.project["id"])
        self.assertEqual(storage.deleted_projects()[0]["id"], self.project["id"])
        restored = storage.restore_project(self.project["id"])
        self.assertEqual(restored["title"], "测试作品")
        self.assertEqual(storage.deleted_projects(), [])

    def test_hybrid_memory_finds_middle_chapter_chunk(self):
        storage.save_registry({"active_id": self.project["id"], "projects": [self.project]})
        results = storage.search_memory_chunks(self.project["id"], "玉佩暗纹证据", 5)
        self.assertTrue(results)
        self.assertIn("玉佩暗纹证据", results[0]["content"])
        self.assertIn("semanticApprox", results[0]["match"])

    def test_second_connection_is_not_blocked_by_schema_metadata(self):
        first = storage._connect()
        second = storage._connect()
        try:
            second.execute("INSERT OR REPLACE INTO app_meta(key, value) VALUES('lock_test', 'ok')")
            second.commit()
        finally:
            second.close()
            first.close()


class NovelFlowAgentSkillTests(unittest.TestCase):
    def test_revision_loop_and_versions_are_public(self):
        ids = [item["id"] for item in agent_skills.CORE_AGENT_SKILLS]
        self.assertLess(ids.index("writer"), ids.index("review"))
        self.assertLess(ids.index("review"), ids.index("reviser"))
        self.assertLess(ids.index("reviser"), ids.index("librarian"))
        self.assertTrue(all(item["version"] for item in agent_skills.public_agent_skills()))
        self.assertEqual(agent_skills.agent_skill("reviser")["schemaVersion"], agent_skills.SKILL_SCHEMA_VERSION)

    def test_quick_create_pack_keys_activate_skills(self):
        text = agent_skills.selected_skill_text({"themePack": "mystery", "audiencePack": "male_upgrade", "stylePacks": ["logic"]})
        self.assertIn("悬疑推理", text)
        self.assertIn("男频升级", text)
        self.assertIn("硬核逻辑", text)


class NovelFlowWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import api_server
        cls.api = api_server

    def test_long_text_chunking_preserves_content(self):
        text = "\n\n".join(f"段落{index}" + ("内容" * 200) for index in range(15))
        chunks = self.api.split_text_chunks(text, max_chars=1_000, max_chunks=20)
        self.assertEqual("".join(chunks), text)

    def test_chapter_renumbering_preserves_body_and_remaps_structured_memory(self):
        project = {
            "chapters": [{"id": "01", "body": "正文一"}, {"id": "03", "body": "正文三"}],
            "memory": {
                "chapter_summaries": {"01": "摘要一", "03": "摘要三"},
                "timeline": [{"chapterId": "03", "event": "事件"}],
                "entities": {"items": [{"firstChapter": "03", "summary": "物品说明"}]},
                "chapter_trash": [{"chapter": {"id": "02", "body": "正文二"}}],
            },
        }
        self.api.renumber_project_chapters(project)
        self.assertEqual([item["id"] for item in project["chapters"]], ["01", "02"])
        self.assertEqual([item["body"] for item in project["chapters"]], ["正文一", "正文三"])
        self.assertEqual(project["memory"]["chapter_summaries"], {"01": "摘要一", "02": "摘要三"})
        self.assertEqual(project["memory"]["timeline"][0]["chapterId"], "02")
        self.assertEqual(project["memory"]["entities"]["items"][0]["firstChapter"], "02")
        self.assertEqual(project["memory"]["chapter_trash"][0]["chapter"]["id"], "02")

    def test_archived_memory_remaps_structured_references_without_touching_prose(self):
        snapshot = {
            "chapter_summaries": {"03": "第三章摘要"},
            "workflow_tasks": [{"chapterId": "03", "note": "继续第三章的线索"}],
            "body": "正文中提到第03章，但这段文字不能被改写。",
        }
        self.api.remap_chapter_memory_snapshot(snapshot, {"03": "02"})
        self.assertEqual(snapshot["chapter_summaries"], {"02": "第三章摘要"})
        self.assertEqual(snapshot["workflow_tasks"][0]["chapterId"], "02")
        self.assertEqual(snapshot["workflow_tasks"][0]["note"], "继续第三章的线索")
        self.assertEqual(snapshot["body"], "正文中提到第03章，但这段文字不能被改写。")

    def test_archived_chapter_restores_at_original_position_with_continuous_ids(self):
        project = {
            "chapters": [{"id": "01", "body": "正文一"}, {"id": "02", "body": "正文三"}],
            "memory": {
                "chapter_summaries": {"01": "摘要一", "02": "摘要三"},
                "timeline": [{"chapterId": "02", "event": "事件三"}],
            },
        }
        archive = {
            "trashId": "02-test",
            "chapterIndex": 1,
            "chapter": {"id": "02", "body": "正文二"},
            "memory": {
                "chapter_summaries": "摘要二",
                "workflow_tasks": [{"chapterId": "02", "status": "done"}],
            },
        }
        restored = self.api.restore_chapter_archive(project, archive)
        self.assertEqual([item["id"] for item in project["chapters"]], ["01", "02", "03"])
        self.assertEqual([item["body"] for item in project["chapters"]], ["正文一", "正文二", "正文三"])
        self.assertEqual(restored["id"], "02")
        self.assertEqual(project["memory"]["chapter_summaries"], {"01": "摘要一", "03": "摘要三", "02": "摘要二"})
        self.assertEqual(project["memory"]["timeline"][0]["chapterId"], "03")
        self.assertEqual(project["memory"]["workflow_tasks"][0]["chapterId"], "02")
    def test_required_workflow_has_reviser_and_librarian(self):
        ids = [item[0] for item in self.api.selected_workflow_steps(["architect"])]
        self.assertIn("writer", ids)
        self.assertIn("review", ids)
        self.assertIn("reviser", ids)
        self.assertIn("librarian", ids)

    def test_demo_reviser_produces_final_draft(self):
        context = {"chapter": {"title": "测试章节", "goal": "推进", "hook": "反转"}}
        steps = self.api.demo_workflow_results(context)
        writer = next(item for item in steps if item["id"] == "writer")
        reviser = next(item for item in steps if item["id"] == "reviser")
        self.assertEqual(reviser["result"]["draft"], writer["result"]["draft"])

    def test_awaiting_review_is_restored_after_restart(self):
        run_id = "a" * 24
        project = {"id": "restore-test", "memory": {"workflow_tasks": [{"id": run_id, "status": "awaiting_review", "chapterId": "01", "candidateDraft": "候选正文", "candidateMemory": {}, "steps": [], "evidence": []}]}}
        self.api.hydrate_workflow_runs(project)
        try:
            self.assertEqual(self.api.workflow_runs[run_id]["draft"], "候选正文")
        finally:
            self.api.workflow_runs.pop(run_id, None)

    def test_writer_context_contains_long_form_constraints_and_evidence(self):
        context = {
            "project": {"title": "长篇", "genre": "悬疑", "settings": {"lengthMode": "long"}},
            "chapter": {"id": "30", "title": "转折", "goal": "推进", "conflict": "对抗", "hook": "线索"},
            "creativePacks": {"themePacks": [{"id": "mystery"}]},
            "story": {"synopsis": "主线", "worldRules": ["线索必须可回溯"], "characters": [{"name": "主角"}], "foreshadows": ["旧票"], "volumes": [{"title": "第二卷"}], "continuityBoard": {"characters": [], "foreshadows": []}, "storyArcs": [{"title": "身份谜团"}], "timeline": [{"event": "三年前失踪"}], "entities": {"locations": [], "items": [], "organizations": [], "abilities": []}},
            "recentChapters": [], "currentDraft": "正文", "retrievedMemory": [{"title": "第十章证据", "content": "旧票编号"}],
        }
        compact = self.api.compact_workflow_context(context, "writer")
        self.assertEqual(compact["worldRules"], ["线索必须可回溯"])
        self.assertEqual(compact["storyArcs"][0]["title"], "身份谜团")
        self.assertEqual(compact["retrievedMemory"][0]["title"], "第十章证据")

    def test_long_form_plan_expands_to_requested_chapter_count(self):
        kit = {"synopsis": "主线", "volumes": [{"title": "卷一", "goal": "建立"}, {"title": "卷二", "goal": "反转"}, {"title": "卷三", "goal": "收束"}], "chapterPlan": [{"title": f"种子{i}", "goal": "推进", "hook": "钩子"} for i in range(8)]}
        plan, volumes, arcs = self.api.expand_long_form_plan(kit, 100)
        self.assertEqual(len(plan), 100)
        self.assertEqual(len(volumes), 3)
        self.assertEqual(len(arcs), 12)
        self.assertTrue(all(item.get("volumeId") and item.get("arcId") for item in plan))

    def test_librarian_patch_updates_structured_memory(self):
        raw = {"characters": [{"name": "沈砚", "state": "恢复部分记忆"}], "timeline": [{"id": "event-2", "chapterId": "02", "event": "发现录音"}], "storyArcs": [{"id": "arc-1", "progress": "身份线推进"}], "entities": {"items": [{"name": "旧车票", "summary": "终点变化"}]}}
        patch = self.api.normalize_memory_patch(raw)
        memory = self.api.merge_memory_patch({"characters": [{"name": "沈砚", "state": "失忆"}], "entities": {"items": []}}, patch, "02")
        self.assertEqual(memory["characters"][0]["state"], "恢复部分记忆")
        self.assertEqual(memory["timeline"][0]["event"], "发现录音")
        self.assertEqual(memory["story_arcs"][0]["progress"], "身份线推进")
        self.assertEqual(memory["entities"]["items"][0]["name"], "旧车票")

    def test_project_kit_and_librarian_memory_are_combined(self):
        records = self.api.merged_story_records(
            [{"name": "沈砚", "role": "调查者", "state": "失忆"}],
            [{"name": "沈砚", "state": "恢复记忆"}, {"name": "岑月", "role": "站务员"}],
        )
        self.assertEqual(records[0]["role"], "调查者")
        self.assertEqual(records[0]["state"], "恢复记忆")
        self.assertEqual(records[1]["name"], "岑月")

    def test_review_score_is_bounded_for_quality_gate(self):
        result = self.api.normalize_agent_result("review", '{"summary":"可用","score":120,"decisions":[],"risks":[],"handoff":[]}')
        self.assertEqual(result["score"], 100)


if __name__ == "__main__":
    unittest.main()
