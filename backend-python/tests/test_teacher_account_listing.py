import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock, patch

from services.teacher_account_listing import list_teacher_accounts


class TeacherAccountListingTests(unittest.TestCase):
    def test_reuses_user_list_when_ensuring_attendance(self):
        user = SimpleNamespace(
            id="teacher-1",
            email="teacher@moes.edu.mn",
            user_metadata={"role": "teacher", "first_name": "Test", "last_name": "Teacher"},
            app_metadata={"role": "teacher", "teacher_attendance": []},
        )
        updated_user = SimpleNamespace(
            id=user.id,
            email=user.email,
            user_metadata=user.user_metadata,
            app_metadata={
                "role": "teacher",
                "teacher_attendance": [{"date": "2026-11-15", "status": "Ирсэн"}],
            },
        )
        admin = SimpleNamespace(
            list_users=Mock(return_value=[user]),
            update_user_by_id=Mock(return_value=SimpleNamespace(user=updated_user)),
        )
        client = SimpleNamespace(auth=SimpleNamespace(admin=admin))

        with (
            patch("services.teacher_account_listing.supabase", client),
            patch("services.teacher_account_listing.mock_data_enabled", return_value=False),
            patch("services.attendance_automation.supabase", client),
            patch("services.attendance_automation.school_today", return_value=date(2026, 11, 15)),
        ):
            teachers = list_teacher_accounts()

        admin.list_users.assert_called_once_with(per_page=1000)
        admin.update_user_by_id.assert_called_once()
        self.assertEqual(teachers[0]["daily_records"], updated_user.app_metadata["teacher_attendance"])


if __name__ == "__main__":
    unittest.main()
