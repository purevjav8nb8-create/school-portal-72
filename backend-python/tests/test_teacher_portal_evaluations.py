import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from schemas.teacher_records import EvaluationCreate
from services.teacher_portal_evaluations import add_evaluation
from services.teacher_portal_profile import homeroom_evaluations


class TeacherPortalEvaluationTests(unittest.TestCase):
    def test_homeroom_evaluations_include_own_subject_evaluations(self):
        user = SimpleNamespace(
            id="teacher-1",
            user_metadata={"unit": "БУЗАН"},
        )
        records = [
            {
                "teacher_id": "teacher-1",
                "teacher_name": "Б. Болд",
                "teacher_email": "bold@moes.edu.mn",
                "payload": {
                    "id": "own-evaluation",
                    "grade": 7,
                    "section": "А",
                    "subject": "Математик",
                    "level": "I",
                    "students_count": 5,
                    "average_score": 80,
                    "evaluation_date": "2026-11-21",
                },
            },
        ]
        own_portal = {
            "teaching_classes": [
                {"grade": 7, "section": "А", "homeroom": True},
            ],
        }
        with (
            patch("services.teacher_portal_profile.mock_data_enabled", return_value=False),
            patch("services.teacher_portal_profile.teacher_portal_data", return_value=own_portal),
            patch("services.teacher_portal_profile.list_portal_records", return_value=records),
        ):
            result = homeroom_evaluations(user)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "teacher-1:own-evaluation")
        self.assertEqual(result[0]["evaluator_id"], "teacher-1")

    def test_accepts_evaluation_for_scheduled_class_outside_profile_unit(self):
        user = SimpleNamespace(id="teacher-1", user_metadata={"unit": "БАЗАН"})
        evaluation = EvaluationCreate(
            grade=12,
            section="Б",
            subject="Математик",
            level="I",
            students_count=1,
            average_score=80,
            evaluation_date=date(2026, 11, 21),
        )
        item = {"id": "evaluation-1"}
        with (
            patch("services.teacher_portal_evaluations.validate_teacher_schedule_assignment") as validate_schedule,
            patch("services.teacher_portal_evaluations.get_portal_collection", return_value=[]),
            patch("services.teacher_portal_evaluations.replace_portal_collection") as save_collection,
        ):
            result = add_evaluation(user, evaluation)

        validate_schedule.assert_called_once_with(
            "teacher-1",
            date(2026, 11, 21),
            12,
            "Б",
            "Математик",
        )
        save_collection.assert_called_once()
        self.assertEqual(result["subject"], "Математик")

    def test_rejects_evaluation_when_class_is_not_in_teacher_schedule(self):
        user = SimpleNamespace(id="teacher-1", user_metadata={"unit": "БУЗАН"})
        evaluation = EvaluationCreate(
            grade=10,
            section="А",
            subject="Математик",
            level="I",
            students_count=1,
            average_score=80,
            evaluation_date=date(2026, 11, 21),
        )
        with (
            patch("services.teacher_portal_evaluations.validate_teacher_schedule_assignment", side_effect=HTTPException(422, "not scheduled")),
            patch("services.teacher_portal_evaluations.get_portal_collection") as get_collection,
            patch("services.teacher_portal_evaluations.replace_portal_collection") as save_collection,
        ):
            with self.assertRaises(HTTPException) as raised:
                add_evaluation(user, evaluation)

        self.assertEqual(raised.exception.status_code, 422)
        get_collection.assert_not_called()
        save_collection.assert_not_called()


if __name__ == "__main__":
    unittest.main()
