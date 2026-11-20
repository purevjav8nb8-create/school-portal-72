import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from schemas.teachers import HomeroomClassesUpdate
from services.teacher_portal_submissions import update_my_teaching_classes


class HomeroomClassUpdateTests(unittest.TestCase):
    def test_teacher_can_only_save_homeroom_classes_not_teaching_hours(self):
        user = SimpleNamespace(
            id="teacher-id",
            user_metadata={"unit": "БУЗАН"},
        )
        submission = HomeroomClassesUpdate.model_validate({
            "classes": [
                {"grade": 10, "section": "А", "weekly_hours": 7, "homeroom": False},
            ],
        })

        with (
            patch("services.teacher_portal_submissions.mock_data_enabled", return_value=False),
            patch("services.teacher_portal_submissions.replace_portal_collection") as save,
        ):
            result = update_my_teaching_classes(user, submission)

        self.assertEqual(result, [{"grade": 10, "section": "А", "weekly_hours": 0, "homeroom": True}])
        save.assert_called_once_with(
            user,
            "teaching_classes",
            [{"grade": 10, "section": "А", "weekly_hours": 0, "homeroom": True}],
            updated_at=unittest.mock.ANY,
        )

    def test_teacher_cannot_set_a_homeroom_outside_their_unit(self):
        user = SimpleNamespace(
            id="teacher-id",
            user_metadata={"unit": "БАЗАН"},
        )
        submission = HomeroomClassesUpdate.model_validate({
            "classes": [{"grade": 10, "section": "А"}],
        })

        with (
            patch("services.teacher_portal_submissions.mock_data_enabled", return_value=False),
            patch("services.teacher_portal_submissions.replace_portal_collection") as save,
        ):
            with self.assertRaises(HTTPException) as raised:
                update_my_teaching_classes(user, submission)

        self.assertEqual(raised.exception.status_code, 422)
        save.assert_not_called()

    def test_homeroom_classes_reject_duplicate_grade_and_section(self):
        with self.assertRaises(ValueError):
            HomeroomClassesUpdate.model_validate({
                "classes": [
                    {"grade": 10, "section": "А"},
                    {"grade": 10, "section": "А"},
                ],
            })


if __name__ == "__main__":
    unittest.main()
