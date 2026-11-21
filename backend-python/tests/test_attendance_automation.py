import unittest
from unittest.mock import Mock, patch

from services.attendance_automation import ensure_today_attendance


class AttendanceAutomationTests(unittest.TestCase):
    def test_does_not_create_attendance_for_teacher_without_identity(self):
        blank_teacher = {
            "user_id": "blank-teacher-id",
            "email": "",
            "first_name": "",
            "last_name": "",
            "role": "teacher",
        }
        client = Mock()

        with (
            patch("services.attendance_automation.mock_data_enabled", return_value=False),
            patch("services.attendance_automation.supabase", client),
        ):
            result = ensure_today_attendance([blank_teacher])

        self.assertEqual(result, [blank_teacher])
        client.table.assert_not_called()


if __name__ == "__main__":
    unittest.main()
