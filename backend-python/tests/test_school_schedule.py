import unittest
from datetime import date
from io import BytesIO
from fastapi import HTTPException, UploadFile
from openpyxl import Workbook, load_workbook

from schemas.teachers import AcademicTerm, AcademicYearUpdate
from services.school_schedule import (
    _calculate_teacher_month,
    _parse_schedule_rows,
    create_schedule_template,
)


class SchoolScheduleTests(unittest.TestCase):
    def test_schedule_template_has_expected_import_columns(self):
        workbook = load_workbook(BytesIO(create_schedule_template()), data_only=True)
        sheet = workbook["Хуваарь"]

        self.assertIsNone(sheet["A3"].value)
        self.assertEqual(
            [sheet.cell(4, column).value for column in range(1, 8)],
            ["Багшийн MOES имэйл", "Анги", "Бүлэг", "Хичээл", "Гараг", "Долоо хоногийн төрөл", "Цагийн дугаар"],
        )

    def test_schedule_template_is_labeled_for_the_selected_academic_year(self):
        workbook = load_workbook(BytesIO(create_schedule_template("2026-2027")), data_only=True)

        self.assertEqual(workbook["Хуваарь"]["A3"].value, "Хичээлийн жил: 2026-2027")

    def _schedule_file(self, rows):
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["Тайлбар"])
        sheet.append(["Багшийн MOES имэйл", "Анги", "Бүлэг", "Хичээл", "Гараг", "Долоо хоногийн төрөл", "Цагийн дугаар"])
        for row in rows:
            sheet.append(row)
        content = BytesIO()
        workbook.save(content)
        content.seek(0)
        return UploadFile(filename="schedule.xlsx", file=content)

    def test_schedule_import_resolves_teacher_and_maps_mongolian_values(self):
        teacher = {
            "user_id": "teacher-id",
            "email": "teacher@moes.edu.mn",
            "first_name": "Болд",
            "last_name": "Б.",
            "role": "teacher",
        }

        lessons = _parse_schedule_rows(
            self._schedule_file([
                ["teacher@moes.edu.mn", 10, "а", "Математик", "Даваа", "Тэгш", 2],
            ]),
            [teacher],
        )

        self.assertEqual(lessons, [{
            "teacher_id": "teacher-id",
            "teacher_email": "teacher@moes.edu.mn",
            "teacher_name": "Б. Болд",
            "grade": 10,
            "section": "А",
            "subject": "Математик",
            "weekday": 1,
            "week_type": "even",
            "lesson_number": 2,
        }])

    def test_schedule_import_rejects_overlapping_week_types(self):
        teacher = {"user_id": "teacher-id", "email": "teacher@moes.edu.mn", "role": "teacher"}

        with self.assertRaises(HTTPException) as raised:
            _parse_schedule_rows(
                self._schedule_file([
                    ["teacher@moes.edu.mn", 10, "А", "Математик", "Даваа", "Бүх", 2],
                    ["teacher@moes.edu.mn", 10, "Б", "Физик", "Даваа", "Тэгш", 2],
                ]),
                [teacher],
            )

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("давхар хуваарьтай", raised.exception.detail)

    def test_workbook_formula_yields_overtime_after_schedule_and_substitute_hours(self):
        lessons = [
            {"grade": 5, "weekday": weekday, "week_type": "all"}
            for weekday, count in enumerate([4, 4, 4, 4, 3], start=1)
            for _ in range(count)
        ]
        result = _calculate_teacher_month(
            lessons=lessons,
            terms=[{"start_date": "2026-10-01", "end_date": "2026-10-31", "grades": []}],
            public_holidays=set(),
            month=date(2026, 10, 1),
            year_start=date(2026, 9, 1),
            substitute_hours=10,
        )

        self.assertEqual(result["weekly_base_hours"], 19)
        self.assertEqual(result["active_workdays"], 22)
        self.assertEqual(result["scheduled_hours"], 83)
        self.assertEqual(result["norm_hours"], 83.6)
        self.assertEqual(result["actual_hours"], 93)
        self.assertEqual(result["overtime_hours"], 9.4)

    def test_grade_scoped_terms_exclude_break_days_and_ignore_public_holidays(self):
        lesson = [{"grade": 10, "weekday": 1, "week_type": "all"}]
        result = _calculate_teacher_month(
            lessons=lesson,
            terms=[{"start_date": "2027-01-11", "end_date": "2027-01-15", "grades": list(range(10, 13))}],
            public_holidays={date(2027, 1, 11)},
            month=date(2027, 1, 1),
            year_start=date(2026, 9, 1),
            substitute_hours=4,
        )

        self.assertEqual(result["active_workdays"], 4)
        self.assertEqual(result["scheduled_hours"], 0)
        self.assertEqual(result["substitute_hours"], 4)
        self.assertEqual(result["actual_hours"], 4)
        self.assertEqual(result["overtime_hours"], 0)

    def test_substitute_time_is_not_counted_when_a_teachers_grades_are_on_break(self):
        result = _calculate_teacher_month(
            lessons=[{"grade": 5, "weekday": 1, "week_type": "all"}],
            terms=[{"start_date": "2027-01-11", "end_date": "2027-01-15", "grades": [10, 11, 12]}],
            public_holidays=set(),
            month=date(2027, 1, 1),
            year_start=date(2026, 9, 1),
            substitute_hours=4,
        )

        self.assertEqual(result["active_workdays"], 0)
        self.assertEqual(result["actual_hours"], 0)
        self.assertEqual(result["norm_hours"], 0)
        self.assertEqual(result["overtime_hours"], 0)

    def test_first_academic_week_is_odd_and_parity_continues_across_breaks(self):
        lesson = [{"grade": 10, "weekday": 1, "week_type": "odd"}]
        result = _calculate_teacher_month(
            lessons=lesson,
            terms=[{"start_date": "2026-09-01", "end_date": "2026-09-30", "grades": []}],
            public_holidays=set(),
            month=date(2026, 9, 1),
            year_start=date(2026, 9, 1),
            substitute_hours=0,
        )

        self.assertEqual(result["weekly_odd_hours"], 1)
        self.assertEqual(result["scheduled_hours"], 2)

    def test_academic_year_rejects_overlapping_terms_for_same_grades(self):
        with self.assertRaises(ValueError):
            AcademicYearUpdate(
                academic_year="2026-2027",
                start_date=date(2026, 9, 1),
                end_date=date(2027, 6, 30),
                terms=[
                    AcademicTerm(
                        id="01c37cf5-c55f-45d7-8841-b35e3a8bf4be",
                        name="I улирал",
                        start_date=date(2026, 9, 1),
                        end_date=date(2026, 10, 30),
                    ),
                    AcademicTerm(
                        id="03478255-14ec-4c57-8449-3c94b6ed0bd4",
                        name="II улирал",
                        start_date=date(2026, 10, 20),
                        end_date=date(2026, 12, 25),
                    ),
                ],
            )

    def test_academic_year_requires_at_least_one_term(self):
        with self.assertRaises(ValueError):
            AcademicYearUpdate(
                academic_year="2026-2027",
                start_date=date(2026, 9, 1),
                end_date=date(2027, 6, 30),
                terms=[],
            )

    def test_grade_specific_remote_term_can_overlap_an_all_grade_term_for_different_dates(self):
        year = AcademicYearUpdate(
            academic_year="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 6, 30),
            terms=[
                AcademicTerm(
                    id="01c37cf5-c55f-45d7-8841-b35e3a8bf4be",
                    name="III улирал цахим",
                    start_date=date(2027, 1, 11),
                    end_date=date(2027, 1, 15),
                    grades=[10, 11, 12],
                    modality="online",
                ),
                AcademicTerm(
                    id="03478255-14ec-4c57-8449-3c94b6ed0bd4",
                    name="III улирал",
                    start_date=date(2027, 1, 18),
                    end_date=date(2027, 3, 26),
                ),
            ],
        )

        self.assertEqual(len(year.terms), 2)
        self.assertEqual(year.terms[0].grades, [10, 11, 12])


if __name__ == "__main__":
    unittest.main()
