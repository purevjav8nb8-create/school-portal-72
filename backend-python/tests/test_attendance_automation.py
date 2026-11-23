import unittest
from datetime import date
from unittest.mock import Mock, patch

from services.attendance_automation import _default_workdays, ensure_today_attendance


class AttendanceAutomationTests(unittest.TestCase):
    def test_default_workdays_exclude_weekends_and_public_holidays(self):
        workdays = _default_workdays(
            date(2026, 11, 1),
            date(2026, 11, 8),
            {date(2026, 11, 2)},
        )

        self.assertEqual(
            [item.isoformat() for item in workdays],
            ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"],
        )

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
