import unittest
from types import SimpleNamespace
from unittest.mock import patch

from schemas.teacher_records import AnnouncementCreate
from services.school_announcements import create_announcement, list_announcements
from services.school_survey_listing import list_surveys
from services.teacher_portal_common import save_teacher_portal_data, teacher_portal_data


class _Query:
    def __init__(self, client, table):
        self.client = client
        self.table_name = table

    def select(self, fields):
        self.client.calls.append(("select", self.table_name, fields))
        return self

    def eq(self, field, value):
        return self

    def order(self, field):
        return self

    def range(self, start, end):
        return self

    def upsert(self, values, on_conflict=None):
        self.client.calls.append(("upsert", self.table_name, values, on_conflict))
        return self

    def delete(self):
        self.client.calls.append(("delete", self.table_name))
        return self

    def execute(self):
        return SimpleNamespace(data=self.client.rows.get(self.table_name, []))


class _Supabase:
    def __init__(self, rows=None):
        self.rows = rows or {}
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return _Query(self, name)


class MigratedPortalStorageTests(unittest.TestCase):
    def test_common_helper_reads_records_from_tables_not_auth_metadata(self):
        plan = {"id": "plan-1"}
        training = {"id": "training-1", "name": "First Aid"}
        client = _Supabase({
            "teacher_program_plans": [{"payload": plan}],
            "teacher_trainings": [{"payload": training}],
        })
        user = SimpleNamespace(
            id="teacher-1",
            user_metadata={"teacher_portal": {"program_plan": {"id": "stale"}, "trainings": []}},
        )

        with (
            patch("services.teacher_portal_storage.supabase", client),
            patch("services.teacher_portal_storage.mock_data_enabled", return_value=False),
        ):
            result = teacher_portal_data(user)

        self.assertEqual(result["program_plan"], plan)
        self.assertEqual(result["trainings"], [training])
        self.assertEqual(result["evaluations"], [])
        queried_tables = [call[1] for call in client.calls if call[0] == "table"]
        self.assertIn("teacher_program_plans", queried_tables)
        self.assertIn("teacher_trainings", queried_tables)
        self.assertNotIn("auth.users", queried_tables)

    def test_common_helper_writes_records_to_table_without_auth_metadata_update(self):
        client = _Supabase()
        user = SimpleNamespace(
            id="teacher-1",
            email="teacher@example.edu",
            user_metadata={"teacher_portal": {"trainings": [{"id": "stale"}]}},
        )
        item = {"id": "training-1", "name": "First Aid"}

        with (
            patch("services.teacher_portal_storage.supabase", client),
            patch("services.teacher_portal_storage.mock_data_enabled", return_value=False),
        ):
            save_teacher_portal_data(user, {"trainings": [item]})

        upserts = [call for call in client.calls if call[0] == "upsert"]
        training_upsert = next(call for call in upserts if call[1] == "teacher_trainings")
        self.assertEqual(training_upsert[2][0]["payload"], item)
        self.assertFalse(any(call[0] == "auth_update" for call in client.calls))

    def test_teacher_announcement_is_written_to_announcement_table(self):
        client = _Supabase()
        user = SimpleNamespace(
            id="teacher-1",
            email="teacher@example.edu",
            user_metadata={"first_name": "T"},
            app_metadata={"role": "teacher"},
        )

        with (
            patch("services.teacher_portal_storage.supabase", client),
            patch("services.teacher_portal_storage.mock_data_enabled", return_value=False),
        ):
            result = create_announcement(user, AnnouncementCreate(title="News", body="Text"))

        upserts = [call for call in client.calls if call[0] == "upsert"]
        self.assertEqual(upserts[0][1], "school_announcements")
        self.assertEqual(upserts[0][2]["payload"], result)

    def test_announcement_list_reads_table_rows(self):
        announcement = {"id": "announcement-1", "title": "News", "kind": "Зар"}
        client = _Supabase({
            "school_announcements": [{"owner_id": "teacher-1", "payload": announcement}],
            "teacher_activities": [],
        })

        with (
            patch("services.teacher_portal_storage.supabase", client),
            patch("services.teacher_portal_storage.mock_data_enabled", return_value=False),
        ):
            result = list_announcements()

        self.assertEqual(result[0]["id"], announcement["id"])
        queried_tables = [call[1] for call in client.calls if call[0] == "table"]
        self.assertEqual(queried_tables, ["school_announcements", "teacher_activities"])

    def test_survey_list_aggregates_table_responses_without_auth_user_listing(self):
        survey = {
            "id": "survey-1",
            "created_by": "teacher-1",
            "questions": [{"text": "Question"}],
            "starts_at": "",
            "ends_at": "",
        }
        client = _Supabase({
            "school_surveys": [{"id": survey["id"], "owner_id": "teacher-1", "payload": survey}],
            "teacher_survey_responses": [{
                "teacher_id": "teacher-2",
                "respondent_name": "Other Teacher",
                "payload": {"survey_id": "survey-1", "question_index": 0, "option": "Yes"},
            }],
        })
        user = SimpleNamespace(
            id="teacher-1",
            email="teacher@example.edu",
            user_metadata={"unit": "БУЗАН"},
            app_metadata={"role": "teacher"},
        )

        with (
            patch("services.teacher_portal_storage.supabase", client),
            patch("services.teacher_portal_storage.mock_data_enabled", return_value=False),
        ):
            result = list_surveys(user)

        self.assertEqual(result[0]["respondent_names"], ["Other Teacher"])
        self.assertEqual(result[0]["response_summary"], {"0": {"Yes": 1}})
        queried_tables = [call[1] for call in client.calls if call[0] == "table"]
        self.assertEqual(queried_tables, ["school_surveys", "teacher_survey_responses"])


if __name__ == "__main__":
    unittest.main()
