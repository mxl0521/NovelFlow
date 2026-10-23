"""HTTP regression tests. Storage, credentials and provider calls are fake."""
import copy
import importlib
import io
import json
import threading
import time
import unittest
from contextlib import ExitStack
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

import novelflow_cloud
import novelflow_storage


def isolated_api_import():
    with ExitStack() as stack:
        stack.enter_context(patch.object(novelflow_cloud, "enabled", return_value=False))
        stack.enter_context(patch.object(novelflow_storage, "load_registry", return_value={"active_id": "", "projects": []}))
        stack.enter_context(patch.object(novelflow_storage, "save_registry"))
        stack.enter_context(patch.object(novelflow_storage, "backup_database"))
        return importlib.import_module("api_server")


class AsyncApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = isolated_api_import()
        cls.real_rate_limit = cls.api.rate_limited
        cls.real_invoke_model = cls.api.invoke_model

    def setUp(self):
        self.stack = ExitStack()
        self.registries = {}
        for user in ("alice", "bob"):
            project = {"id": user, "title": user, "chapters": [
                {"id": f"{index:02d}", "title": f"第{index}章", "body": f"{user}正文{index}" if index <= 4 else ""}
                for index in range(1, 121)
            ], "memory": {}}
            self.api.ensure_project_schema(project)
            self.registries[user] = {"active_id": user, "projects": [project]}
        self.stack.enter_context(patch.object(novelflow_cloud, "enabled", return_value=True))
        self.stack.enter_context(patch.object(self.api, "auth_required", return_value=True))
        self.stack.enter_context(patch.object(self.api, "supabase_validate_access_token", side_effect=lambda token: {"id": token} if token in self.registries else None))
        self.stack.enter_context(patch.object(self.api, "load_sqlite_registry", side_effect=lambda fallback, **_kwargs: copy.deepcopy(self.registries[novelflow_cloud.owner_id()])))
        self.saved_owners = []
        def save(registry, **_kwargs):
            owner = novelflow_cloud.owner_id()
            self.saved_owners.append(owner)
            self.registries[owner] = copy.deepcopy(registry)
        self.storage_save = self.stack.enter_context(patch.object(self.api, "save_sqlite_registry", side_effect=save))
        self.stack.enter_context(patch.object(self.api, "load_profiles", return_value=[]))
        self.stack.enter_context(patch.object(self.api, "load_managed_profiles", side_effect=lambda: [{"id": "shared", "model": novelflow_cloud.owner_id()}]))
        self.stack.enter_context(patch.object(self.api, "profile_api_key", return_value="fake-test-key"))
        self.stack.enter_context(patch.object(self.api, "rate_limited", return_value=False))
        self.model = self.stack.enter_context(patch.object(self.api, "invoke_model", return_value='{"synopsis":"资料"}'))
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), self.api.ApiHandler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.task_ids = []
        self.release = threading.Event()

    def tearDown(self):
        self.release.set()
        for task_id in self.task_ids:
            self.finished(task_id)
        self.server.shutdown()
        self.server.server_close()
        self.server_thread.join(2)
        self.stack.close()
        with self.api.async_tasks_lock:
            for task_id in self.task_ids:
                self.api.async_tasks.pop(task_id, None)

    def http(self, path, user="alice", payload=None, origin=None):
        headers = {}
        if user:
            headers["Authorization"] = f"Bearer {user}"
        if origin:
            headers["Origin"] = origin
        data = None if payload is None else json.dumps(payload).encode()
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = Request(self.url + path, data=data, headers=headers)
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def queue(self, path="/api/project/dossier/refresh", user="alice", payload=None):
        status, result = self.http(path, user, payload if payload is not None else {"profileId": "shared"})
        self.assertEqual(status, 202, result)
        self.task_ids.append(result["taskId"])
        return result["taskId"]

    def finished(self, task_id):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            with self.api.async_tasks_lock:
                task = dict(self.api.async_tasks[task_id])
            if task["status"] not in {"queued", "running"}:
                return task
            time.sleep(0.01)
        self.fail(f"Task {task_id} did not finish")

    def test_new_routes_queue_without_waiting_and_preserve_large_preview(self):
        paths = {
            "/api/project/dossier/refresh": "_refresh_story_dossier",
            "/api/assistant": "_ask_assistant",
            "/api/assistant/action-preview": "_assistant_action_preview",
            "/api/inspiration": "_generate_inspirations",
        }
        seen = []
        def blocked(handler):
            seen.append(handler._read_payload())
            if not self.release.wait(4):
                raise RuntimeError("test worker did not release")
            handler._send_json(200, {"ok": True})
        for method in paths.values():
            self.stack.enter_context(patch.object(self.api.ApiHandler, method, blocked))
        for path in paths:
            payload = {"currentDraft": "正文" * 20_000} if path.endswith("action-preview") else {}
            task_id = self.queue(path, payload=payload)
            status, result = self.http(f"/api/ai-tasks/{task_id}")
            self.assertEqual(status, 200)
            self.assertIn(result["status"], {"queued", "running"})
        self.release.set()
        for task_id in self.task_ids:
            self.assertEqual(self.finished(task_id)["httpStatus"], 200)
        self.assertTrue(any(len(item.get("currentDraft", "")) == 40_000 for item in seen))

    def test_poll_requires_login_and_enforces_task_owner(self):
        task_id = self.queue()
        self.finished(task_id)
        path = f"/api/ai-tasks/{task_id}"
        self.assertEqual(self.http(path, user="")[0], 401)
        self.assertEqual(self.http(path, user="bob")[0], 404)
        self.assertEqual(self.http(path, user="alice")[0], 200)

    def test_async_route_rejects_untrusted_origin_and_missing_login(self):
        self.assertEqual(self.http("/api/assistant", payload={}, origin="https://untrusted.invalid")[0], 403)
        self.assertEqual(self.http("/api/assistant", user="", payload={})[0], 401)
        self.model.assert_not_called()

    def test_two_users_generate_concurrently_with_isolated_projects_and_profiles(self):
        started = {user: threading.Event() for user in self.registries}
        observations = []
        def model(profile, _system, prompt, **_kwargs):
            user = novelflow_cloud.owner_id()
            observations.append((user, profile["model"], self.api._state().PROJECT["title"], json.loads(prompt)["project"]["title"]))
            started[user].set()
            self.release.wait(4)
            observations.append((user, profile["model"], self.api._state().PROJECT["title"], json.loads(prompt)["project"]["title"]))
            return json.dumps({"synopsis": user})
        self.model.side_effect = model
        initial = self.api.ApiHandler._snapshot_state(None)
        alice = self.queue(user="alice")
        bob = self.queue(user="bob")
        self.assertTrue(started["alice"].wait(2))
        self.assertTrue(started["bob"].wait(2), "Second user's model call must overlap the first")
        status, result = self.http("/api/project", user="alice")
        self.assertEqual(status, 200)
        self.assertEqual(result["project"]["title"], "alice")
        self.assertEqual(self.http(f"/api/ai-tasks/{bob}", "bob")[0], 200)
        self.release.set()
        self.assertEqual(self.finished(alice)["httpStatus"], 200)
        self.assertEqual(self.finished(bob)["httpStatus"], 200)
        self.assertTrue(all(len(set(observation)) == 1 for observation in observations), observations)
        self.assertEqual(self.registries["alice"]["projects"][0]["memory"]["story_dossier"]["synopsis"], "alice")
        self.assertEqual(self.registries["bob"]["projects"][0]["memory"]["story_dossier"]["synopsis"], "bob")
        self.assertEqual(self.api.ApiHandler._snapshot_state(None), initial)
        self.assertEqual(novelflow_cloud.owner_id(), "")

    def test_dossier_reads_four_written_chapters_among_120_planned(self):
        task = self.finished(self.queue())
        self.assertEqual(task["httpStatus"], 200)
        source = json.loads(self.model.call_args.args[2])
        self.assertEqual([chapter["id"] for chapter in source["chapters"]], ["01", "02", "03", "04"])
        self.assertTrue(all(chapter["bodyExcerpt"] for chapter in source["chapters"]))
        self.assertEqual(task["result"]["dossier"]["updatedThroughChapter"], "04")
        self.assertEqual(task["result"]["memory"]["story_dossier_meta"]["sourceChapterIds"], ["01", "02", "03", "04"])

    def test_dossier_runs_incrementally_and_resumes_after_a_failure(self):
        calls = []
        def model(_profile, _system, prompt, **_kwargs):
            source = json.loads(prompt)
            calls.append(source)
            if len(calls) == 2:
                raise RuntimeError("simulated upstream timeout")
            return json.dumps({"synopsis": f"已整理 {len(source['chapters'])} 个正文片段"})
        self.model.side_effect = model
        project = self.registries["alice"]["projects"][0]
        project["chapters"] = project["chapters"][:4]
        project["chapters"][0]["body"] = "一" * 15000
        for chapter in project["chapters"][1:]:
            chapter["body"] = ""
        task = self.finished(self.queue())
        self.assertEqual(task["httpStatus"], 502)
        saved = self.registries["alice"]["projects"][0]["memory"]["story_dossier_meta"]
        self.assertTrue(saved["processedSegments"])
        self.assertTrue(saved["pending"])
        retried = self.finished(self.queue())
        self.assertEqual(retried["httpStatus"], 200)
        self.assertTrue(calls[-1]["previousDossier"], "The retry reuses the already-generated dossier")
        self.assertEqual(len(calls[-1]["chapters"]), 1, "The retry only sends the remaining changed segment")
        self.assertEqual(retried["result"]["dossier"]["updatedThroughChapter"], "01")

    def test_dossier_does_not_call_model_again_when_source_is_unchanged(self):
        first = self.finished(self.queue())
        self.assertEqual(first["httpStatus"], 200)
        calls = self.model.call_count
        second = self.finished(self.queue())
        self.assertEqual(second["httpStatus"], 200)
        self.assertTrue(second["result"]["unchanged"])
        self.assertEqual(self.model.call_count, calls)

    def test_blank_chapters_do_not_call_model(self):
        for chapter in self.registries["alice"]["projects"][0]["chapters"]:
            chapter["body"] = "  "
        task = self.finished(self.queue())
        self.assertEqual(task["httpStatus"], 409)
        self.model.assert_not_called()

    def test_edit_saved_during_generation_is_not_overwritten(self):
        started = threading.Event()
        def model(*_args, **_kwargs):
            started.set()
            self.release.wait(4)
            return '{"synopsis":"旧资料"}'
        self.model.side_effect = model
        task_id = self.queue()
        self.assertTrue(started.wait(2))
        status, result = self.http("/api/project/chapters/save", payload={"id": "01", "body": "刚保存的新正文", "baseRevision": 0})
        self.assertEqual(status, 200, result)
        self.release.set()
        task = self.finished(task_id)
        self.assertEqual(task["httpStatus"], 200)
        self.assertEqual(self.registries["alice"]["projects"][0]["chapters"][0]["body"], "刚保存的新正文")
        self.assertEqual(self.storage_save.call_count, 2, "The dossier must re-read the new prose and merge only its own fields")
        self.assertEqual(self.model.call_count, 2)
        self.assertIn("刚保存的新正文", self.model.call_args.args[2])

    def test_users_on_same_router_have_independent_rate_and_quota_limits(self):
        with patch.object(self.api, "RATE_LIMIT", 1), patch.object(self.api, "DAILY_MODEL_CALL_LIMIT", 1):
            for user in ("test-limit-alice", "test-limit-bob"):
                token = novelflow_cloud.set_owner_id(user)
                try:
                    self.assertFalse(type(self).real_rate_limit("shared-heroku-router"))
                    self.assertFalse(self.api.consume_model_quota("shared-heroku-router", "same-profile"))
                    self.assertTrue(type(self).real_rate_limit("shared-heroku-router"))
                    self.assertTrue(self.api.consume_model_quota("shared-heroku-router", "same-profile"))
                finally:
                    novelflow_cloud.reset_owner_id(token)
                    self.api.request_times.pop(f"user:{user}", None)
                    for key in list(self.api.model_usage):
                        if key[0].startswith(f"user:{user}:"):
                            self.api.model_usage.pop(key)

    def test_failed_model_task_does_not_change_other_user_or_module_state(self):
        self.model.side_effect = lambda profile, *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("fake provider error")) if profile["model"] == "alice" else '{"synopsis":"bob"}'
        initial = self.api.ApiHandler._snapshot_state(None)
        self.assertEqual(self.finished(self.queue(user="alice"))["httpStatus"], 502)
        self.assertEqual(self.finished(self.queue(user="bob"))["httpStatus"], 200)
        self.assertEqual(self.saved_owners, ["bob"])
        self.assertEqual(self.api.ApiHandler._snapshot_state(None), initial)

    def test_assistant_accepts_long_history_without_using_request_stream_in_worker(self):
        self.model.return_value = "助手回复"
        self.stack.enter_context(patch.object(self.api, "memory_search", return_value=[]))
        task_id = self.queue("/api/assistant", payload={"message": "继续写", "chapterId": "01", "profileId": "shared", "history": [{"role": "user", "content": f"问题{i}"} for i in range(30)]})
        task = self.finished(task_id)
        self.assertEqual(task["httpStatus"], 200, task)
        self.assertEqual(task["result"]["reply"], "助手回复")

    def test_short_selected_question_succeeds_with_long_chapter_history(self):
        self.model.return_value = "这句话是在核对人物行踪。"
        self.stack.enter_context(patch.object(self.api, "memory_search", return_value=[]))
        message = "请分析这段文字：新郎笔录里，他死前一周的行踪是怎么写的？"
        for chapter_id, history in [("03", [{"role": "assistant", "content": "以前的长回复。" * 1000}]), ("04", [])]:
            task = self.finished(self.queue("/api/assistant", payload={"message": message, "chapterId": chapter_id, "profileId": "shared", "history": history}))
            self.assertEqual(task["httpStatus"], 200, task)
            self.assertEqual(task["result"]["reply"], "这句话是在核对人物行踪。")

    def test_assistant_ignores_error_and_status_records_in_persisted_history(self):
        self.model.return_value = "正常回复"
        self.stack.enter_context(patch.object(self.api, "memory_search", return_value=[]))
        self.registries["alice"]["projects"][0]["memory"]["assistant_threads"] = {"03": [
            {"role": "user", "content": "以前的问题"},
            {"role": "assistant", "content": "以前的正常回复"},
            {"role": "assistant", "content": "不要发送的报错", "error": True},
            {"role": "assistant", "content": "不要发送的操作提示", "status": True},
        ]}
        task = self.finished(self.queue("/api/assistant", payload={"message": "解释这句话", "chapterId": "03", "profileId": "shared", "history": [None, {"role": "system", "content": "错误角色"}, {"role": "assistant", "content": 42}]}))
        self.assertEqual(task["httpStatus"], 200, task)
        prompt = self.model.call_args.args[2]
        self.assertIn("以前的正常回复", prompt)
        self.assertNotIn("不要发送", prompt)
        self.assertNotIn("错误角色", prompt)

    def test_assistant_invalid_fields_have_specific_errors(self):
        cases = [({"message": "文字" * 2500}, "提问内容不能超过"), ({"chapterId": "invalid"}, "章节编号不正确"), ({"history": {}}, "对话历史格式不正确")]
        for patch_payload, expected in cases:
            payload = {"message": "解释这句话", "chapterId": "03", "profileId": "shared", "history": []}
            payload.update(patch_payload)
            task = self.finished(self.queue("/api/assistant", payload=payload))
            self.assertEqual(task["httpStatus"], 400, task)
            self.assertIn(expected, task["result"]["error"])
        self.model.assert_not_called()

    def test_json_array_and_invalid_content_length_report_errors(self):
        self.assertEqual(self.http("/api/assistant", payload=[])[0], 400)
        handler = object.__new__(self.api.ApiHandler)
        handler.headers = {"Content-Length": "invalid"}
        handler.rfile = io.BytesIO(b"{}")
        responses = []
        handler._send_json = lambda status, payload: responses.append(status)
        self.assertIsNone(handler._read_payload())
        self.assertEqual(responses, [400])

    def test_provider_read_timeout_keeps_its_timeout_classification(self):
        request = self.api.httpx.Request("POST", "https://aiport.systems/v1/chat/completions")
        timeout = self.api.httpx.ReadTimeout("fake read timeout", request=request)
        with patch.object(self.api.httpx, "post", side_effect=timeout) as post, patch.object(self.api.time, "sleep"):
            with self.assertRaises(self.api.APITimeoutError) as raised:
                type(self).real_invoke_model({"base_url": "https://aiport.systems/v1", "model": "fake"}, "", "test")
        self.assertEqual(post.call_count, 1, "Do not repeat a potentially billed generation after a read timeout")
        self.assertIn("响应超时", self.api.provider_error_message(raised.exception))

    def test_provider_rejection_is_not_retried_as_a_transient_failure(self):
        request = self.api.httpx.Request("POST", "https://aiport.systems/v1/chat/completions")
        response = self.api.httpx.Response(403, text="fake rejection", request=request)
        with patch.object(self.api.httpx, "post", return_value=response) as post:
            with self.assertRaises(self.api.ProviderHTTPError):
                type(self).real_invoke_model({"base_url": "https://aiport.systems/v1", "model": "fake"}, "", "test")
        self.assertEqual(post.call_count, 1)


if __name__ == "__main__":
    unittest.main()
