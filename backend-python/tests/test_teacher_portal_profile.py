import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from services.teacher_portal_profile import get_my_program_plan


class TeacherPortalProfileTests(unittest.TestCase):
    def test_reads_program_plan_from_teacher_metadata(self):
        plan = {"review_status": "returned"}
        user = SimpleNamespace(user_metadata={"teacher_portal": {"program_plan": plan}})

        with patch("services.teacher_portal_profile.mock_data_enabled", return_value=False):
            self.assertEqual(get_my_program_plan(user), plan)

    def test_reads_program_plan_from_mock_teacher(self):
        first_plan = {"id": "first-plan", "review_status": "returned"}
        second_plan = {"id": "second-plan", "review_status": "returned"}
        teachers = {
            "first-teacher": {"program_plan": first_plan},
            "second-teacher": {"program_plan": second_plan},
        }

        with (
            patch("services.teacher_portal_profile.mock_data_enabled", return_value=True),
            patch(
                "services.teacher_portal_profile.get_mock_teacher_by_id",
                side_effect=lambda user_id: teachers.get(user_id),
            ),
        ):
            self.assertEqual(get_my_program_plan(SimpleNamespace(id="first-teacher")), first_plan)
            self.assertEqual(get_my_program_plan(SimpleNamespace(id="second-teacher")), second_plan)

    def test_program_plan_endpoint_uses_only_authenticated_teacher(self):
        from routers.teachers_profile import get_my_program_plan_status

        teacher = SimpleNamespace(id="first-teacher")
        plan = {"id": "first-plan", "review_status": "returned"}

        with (
            patch("routers.teachers_profile.require_teacher", return_value=teacher),
            patch("routers.teachers_profile.get_my_program_plan", return_value=plan) as get_plan,
        ):
            result = get_my_program_plan_status("Bearer token")

        get_plan.assert_called_once_with(teacher)
        self.assertEqual(result, {"program_plan": plan})

    def test_missing_mock_teacher_is_reported(self):
        user = SimpleNamespace(id="missing-teacher")

        with (
            patch("services.teacher_portal_profile.mock_data_enabled", return_value=True),
            patch("services.teacher_portal_profile.get_mock_teacher_by_id", return_value=None),
        ):
            with self.assertRaises(HTTPException) as raised:
                get_my_program_plan(user)

        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
