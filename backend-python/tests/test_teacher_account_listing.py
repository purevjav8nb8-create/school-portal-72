import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock, patch

from services.teacher_account_listing import list_teacher_accounts


class TeacherAccountListingTests(unittest.TestCase):
    def test_uses_profile_table_and_attendance_table_without_auth_user_listing(self):
        profile = {
            "user_id": "teacher-1",
            "email": "teacher@moes.edu.mn",
            "first_name": "Test",
            "last_name": "Teacher",
            "unit": "БАЗАН",
            "subject": "Математик",
            "role": "teacher",
        }
        admin = SimpleNamespace(
            list_users=Mock(side_effect=AssertionError("Auth user list must not be used.")),
        )
        query = Mock()
        query.select.return_value = query
        query.eq.return_value = query
        query.gte.return_value = query
        query.lte.return_value = query
        query.in_.return_value = query
        query.order.return_value = query
        query.upsert.return_value = query
        query.execute.side_effect = [
            SimpleNamespace(data=[{"start_date": "2026-11-15", "end_date": "2027-06-30"}]),
            SimpleNamespace(data=[]),
            SimpleNamespace(data=[]),
            SimpleNamespace(data=[{
                "teacher_id": profile["user_id"],
                "attendance_date": "2026-11-15",
                "status": "Ирсэн",
            }]),
        ]
        client = SimpleNamespace(
            auth=SimpleNamespace(admin=admin),
            table=Mock(return_value=query),
        )

        with (
            patch("services.teacher_account_listing.supabase", client),
            patch("services.teacher_account_listing.mock_data_enabled", return_value=False),
            patch("services.teacher_account_listing.list_teacher_profiles", return_value=[profile]),
            patch("services.teacher_account_listing.list_teacher_portal_data_by_id", return_value={}),
            patch("services.attendance_automation.supabase", client),
            patch("services.attendance_automation.school_today", return_value=date(2026, 11, 15)),
        ):
            teachers = list_teacher_accounts()

        admin.list_users.assert_not_called()
        self.assertEqual(teachers[0]["daily_records"], [{"date": "2026-11-15", "status": "Ирсэн"}])
        client.table.assert_called_with("teacher_attendance")


if __name__ == "__main__":
    unittest.main()
