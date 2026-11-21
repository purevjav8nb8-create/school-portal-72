import unittest

from services.report_rows import rows_for_teacher


class ReportRowsTests(unittest.TestCase):
    def test_attendance_report_omits_teacher_without_name_or_email(self):
        rows = rows_for_teacher(
            {
                "last_name": "",
                "first_name": "",
                "email": "",
                "subject": "Математик",
                "daily_records": [{"date": "2026-11-02", "status": "Ирсэн"}],
            },
            "Ирц",
            "2026-11",
        )

        self.assertEqual(rows, [])

    def test_attendance_report_uses_email_when_teacher_name_is_missing(self):
        rows = rows_for_teacher(
            {
                "last_name": "",
                "first_name": "",
                "email": "teacher@moes.edu.mn",
                "subject": "Математик",
                "daily_records": [{"date": "2026-11-02", "status": "Ирсэн"}],
            },
            "Ирц",
            "2026-11",
        )

        self.assertEqual(rows[0]["Багш"], "teacher@moes.edu.mn")
        self.assertEqual(rows[0]["Хичээл"], "Математик")
        self.assertEqual(rows[0]["2"], "И")
        self.assertEqual(list(rows[0])[:3], ["Багш", "Хичээл", "2"])


if __name__ == "__main__":
    unittest.main()
