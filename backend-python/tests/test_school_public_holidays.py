import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

from schemas.teachers import PublicHolidayCreate
from services.school_public_holidays import delete_public_holiday, list_public_holidays, save_public_holiday, save_public_holidays


class PublicHolidayTests(unittest.TestCase):
    def test_list_returns_formatted_holidays_for_requested_year(self):
        table = Mock()
        table.select.return_value = table
        table.gte.return_value = table
        table.lte.return_value = table
        table.order.return_value = table
        table.execute.return_value = SimpleNamespace(data=[
            {"holiday_date": "2026-11-26", "name": "Улс тунхагласны өдөр"},
        ])
        client = Mock()
        client.table.return_value = table

        with patch("services.school_public_holidays.supabase", client):
            holidays = list_public_holidays(2026)

        self.assertEqual(holidays, [{"date": "2026-11-26", "name": "Улс тунхагласны өдөр"}])
        table.gte.assert_called_once_with("holiday_date", "2026-01-01")
        table.lte.assert_called_once_with("holiday_date", "2026-12-31")

    def test_save_rejects_date_from_different_year(self):
        client = Mock()
        holiday = PublicHolidayCreate(holiday_date=date(2027, 1, 1))

        with patch("services.school_public_holidays.supabase", client):
            with self.assertRaises(HTTPException) as raised:
                save_public_holiday(2026, holiday, SimpleNamespace(id="admin-id"))

        self.assertEqual(raised.exception.status_code, 422)
        client.table.assert_not_called()

    def test_save_upserts_holiday_with_admin_id(self):
        table = Mock()
        table.upsert.return_value.execute.return_value = SimpleNamespace(data=[])
        client = Mock()
        client.table.return_value = table
        holiday = PublicHolidayCreate(
            holiday_date=date(2026, 11, 26),
            name="Улс тунхагласны өдөр",
        )

        with patch("services.school_public_holidays.supabase", client):
            result = save_public_holiday(2026, holiday, SimpleNamespace(id="admin-id"))

        self.assertEqual(result, {"date": "2026-11-26", "name": "Улс тунхагласны өдөр"})
        table.upsert.assert_called_once()
        self.assertEqual(table.upsert.call_args.args[0]["created_by"], "admin-id")
        self.assertEqual(table.upsert.call_args.kwargs["on_conflict"], "holiday_date")

    def test_bulk_save_upserts_all_holidays_in_one_request(self):
        table = Mock()
        table.upsert.return_value.execute.return_value = SimpleNamespace(data=[
            {"holiday_date": "2026-01-01", "name": "Шинэ жил"},
            {"holiday_date": "2026-02-18", "name": "Цагаан сар"},
        ])
        client = Mock()
        client.table.return_value = table
        holidays = [
            PublicHolidayCreate(holiday_date=date(2026, 1, 1), name="Шинэ жил"),
            PublicHolidayCreate(holiday_date=date(2026, 2, 18), name="Цагаан сар"),
        ]

        with patch("services.school_public_holidays.supabase", client):
            result = save_public_holidays(2026, holidays, SimpleNamespace(id="admin-id"))

        self.assertEqual(result, [
            {"date": "2026-01-01", "name": "Шинэ жил"},
            {"date": "2026-02-18", "name": "Цагаан сар"},
        ])
        table.upsert.assert_called_once()
        self.assertEqual(len(table.upsert.call_args.args[0]), 2)

    def test_bulk_save_rejects_mixed_years_without_writing(self):
        client = Mock()
        holidays = [
            PublicHolidayCreate(holiday_date=date(2026, 1, 1)),
            PublicHolidayCreate(holiday_date=date(2027, 1, 1)),
        ]

        with patch("services.school_public_holidays.supabase", client):
            with self.assertRaises(HTTPException) as raised:
                save_public_holidays(2026, holidays, SimpleNamespace(id="admin-id"))

        self.assertEqual(raised.exception.status_code, 422)
        client.table.assert_not_called()

    def test_delete_removes_date_from_selected_year(self):
        table = Mock()
        table.delete.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])
        client = Mock()
        client.table.return_value = table

        with patch("services.school_public_holidays.supabase", client):
            delete_public_holiday(2026, date(2026, 11, 26))

        table.delete.return_value.eq.assert_called_once_with("holiday_date", "2026-11-26")


if __name__ == "__main__":
    unittest.main()
