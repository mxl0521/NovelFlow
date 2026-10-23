import unittest

from novelflow_dossier import plan


class DossierPlanningTests(unittest.TestCase):
    def project(self, chapters):
        return {"id": "book", "chapters": chapters, "memory": {}}

    def test_written_chapters_are_sorted_numerically_and_planned_to_latest(self):
        project = self.project([
            {"id": "10", "body": "ten", "revision": 1},
            {"id": "02", "body": "two", "revision": 1},
            {"id": "11", "body": "   ", "revision": 0},
            {"id": "03", "body": "three", "revision": 1},
        ])
        result = plan(project)
        self.assertEqual(result["updatedThroughChapter"], "10")
        self.assertEqual([c["id"] for c in result["chapters"]], ["02", "03", "10"])

    def test_large_chapter_is_segmented_and_short_retry_sends_only_unprocessed(self):
        project = self.project([{"id": "01", "body": "A" * 15000, "revision": 2}])
        first = plan(project)
        self.assertTrue(first["pending"])
        self.assertGreater(first["totalSegments"], 1)
        project["memory"]["story_dossier"] = {"synopsis": "already processed"}
        project["memory"]["story_dossier_meta"] = {"schemaVersion": 2,
            "processedSegments": first["processedSegments"]}
        second = plan(project)
        self.assertEqual(len(second["chapters"]), 1)
        self.assertEqual(second["previousDossier"]["synopsis"], "already processed")
        self.assertFalse(second["pending"])
        self.assertEqual(second["updatedThroughChapter"], "01")

    def test_editing_an_earlier_chapter_invalidates_cursor(self):
        project = self.project([{"id": "01", "body": "old", "revision": 1}, {"id": "02", "body": "two", "revision": 1}])
        previous = plan(project)
        project["memory"]["story_dossier"] = {"synopsis": "old"}
        project["memory"]["story_dossier_meta"] = {"schemaVersion": 2, "processedSegments": previous["processedSegments"]}
        project["chapters"][0]["body"] = "edited"
        restarted = plan(project)
        self.assertEqual(len(restarted["chapters"]), 2)
        self.assertFalse(restarted["previousDossier"])


if __name__ == "__main__":
    unittest.main()
