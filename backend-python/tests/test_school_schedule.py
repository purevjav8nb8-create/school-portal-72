import unittest
from datetime import date
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock, patch
from fastapi import HTTPException, UploadFile
from openpyxl import Workbook, load_workbook

from schemas.teachers import AcademicTerm, AcademicYearUpdate
from services.school_schedule import (
    _calculate_teacher_month,
    delete_academic_year,
    _parse_schedule_file,
    _parse_schedule_rows,
    get_teacher_schedule_assignments,
    import_teacher_schedule,
    validate_teacher_schedule_assignment,
    create_schedule_template,
)


class SchoolScheduleTests(unittest.TestCase):
    def test_delete_academic_year_removes_selected_year(self):
        table = Mock()
        table.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[
            {"academic_year": "2027-2028", "start_date": "2027-09-01", "end_date": "2028-06-30", "terms": []},
        ])
        table.delete.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])
        client = Mock()
        client.table.return_value = table

        with patch("services.school_schedule.supabase", client):
            delete_academic_year("2027-2028")

        table.delete.return_value.eq.assert_called_once_with("academic_year", "2027-2028")

    def test_delete_academic_year_returns_not_found_without_deleting(self):
        table = Mock()
        table.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])
        client = Mock()
        client.table.return_value = table

        with patch("services.school_schedule.supabase", client):
            with self.assertRaises(HTTPException) as raised:
                delete_academic_year("2027-2028")

        self.assertEqual(raised.exception.status_code, 404)
        table.delete.assert_not_called()

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

    def _timetable_file(self, rows):
        workbook = Workbook()
        sheet = workbook.active
        day_starts = [8, 22, 36, 50, 64]
        for column, day in zip(day_starts, ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан"]):
            sheet.cell(5, column, day)
        sheet["C5"] = "Мэргэжил"
        sheet["D5"] = "Багш нарын нэр"
        sheet["G5"] = "Даасан анги"
        sheet["B5"] = "№"
        for start in day_starts:
            for period in range(14):
                sheet.cell(7, start + period, period % 7 + 1)
        for row_number, values in enumerate(rows, start=8):
            subject, name, homeroom, monday_slots, tuesday_slots = values
            sheet.cell(row_number, 2, row_number - 7)
            sheet.cell(row_number, 3, subject)
            sheet.cell(row_number, 4, name)
            sheet.cell(row_number, 7, homeroom)
            for period, class_name in monday_slots.items():
                sheet.cell(row_number, day_starts[0] + period - 1, class_name)
            for period, class_name in tuesday_slots.items():
                sheet.cell(row_number, day_starts[1] + period - 1, class_name)
        content = BytesIO()
        workbook.save(content)
        content.seek(0)
        return UploadFile(filename="schedule.xlsx", file=content)

    def _timetable_profiles(self):
        return [
            {
                "user_id": "teacher-1",
                "email": "teacher1@moes.edu.mn",
                "first_name": "Болд",
                "last_name": "Б.",
                "unit": "БУЗАН",
                "role": "teacher",
            },
            {
                "user_id": "teacher-2",
                "email": "teacher2@moes.edu.mn",
                "first_name": "Сүрэн",
                "last_name": "С.",
                "unit": "БУЗАН",
                "role": "teacher",
            },
        ]

    def test_timetable_homeroom_does_not_depend_on_teacher_unit(self):
        file = self._timetable_file([
            ("Математик", "Б. Болд", "12б", {1: "12б"}, {}),
        ])

        profiles = self._timetable_profiles()
        profiles[0]["unit"] = "БАЗАН"

        lessons, homerooms, _ = _parse_schedule_file(file, profiles)

        self.assertEqual(lessons[0]["grade"], 12)
        self.assertEqual(homerooms["teacher-1"][0]["grade"], 12)

    def test_import_school_timetable_extracts_lessons_and_homeroom_classes(self):
        file = self._timetable_file([
            ("Математик", "Б. Болд", "6а", {1: "6а", 8: "6б"}, {}),
            ("", "С. Сүрэн", "", {}, {1: "7в", 2: "10аб"}),
        ])

        with (
            patch("services.school_schedule._get_academic_year", return_value={"academic_year": "2026-2027"}),
            patch("services.school_schedule.list_teacher_profiles", return_value=self._timetable_profiles()),
            patch("services.school_schedule.replace_portal_collection") as save_classes,
            patch("services.school_schedule._client") as client_factory,
        ):
            table = Mock()
            table.upsert.return_value.execute.return_value = SimpleNamespace(data=[])
            client_factory.return_value.table.return_value = table
            result = import_teacher_schedule("2026-2027", file, SimpleNamespace(id="admin-id"))

        self.assertEqual(result, {
            "imported_lessons": 4,
            "teachers": 2,
            "homeroom_teachers": 2,
            "homeroom_classes": 1,
        })
        lessons = table.upsert.call_args.args[0]["lessons"]
        self.assertEqual(
            [(item["teacher_id"], item["weekday"], item["lesson_number"], item["subject"]) for item in lessons],
            [
                ("teacher-1", 1, 1, "Математик"),
                ("teacher-1", 1, 8, "Математик"),
                ("teacher-2", 2, 1, "Математик"),
                ("teacher-2", 2, 2, "Математик"),
            ],
        )
        self.assertEqual(lessons[3]["grade"], 10)
        self.assertEqual(lessons[3]["section"], "АБ")
        self.assertEqual(save_classes.call_count, 2)
        self.assertEqual(save_classes.call_args_list[0].args[2], [
            {"grade": 6, "section": "А", "weekly_hours": 0, "homeroom": True},
        ])
        self.assertEqual(save_classes.call_args_list[1].args[2], [])

    def test_teacher_schedule_assignments_expand_combined_sections(self):
        client = Mock()
        years = [{
            "academic_year": "2026-2027",
            "start_date": "2026-09-01",
            "end_date": "2027-06-30",
        }]
        schedules = [{
            "academic_year": "2026-2027",
            "lessons": [
                {"teacher_id": "teacher-1", "grade": 10, "section": "АБ", "subject": "Математик"},
                {"teacher_id": "teacher-2", "grade": 10, "section": "В", "subject": "Физик"},
            ],
        }]
        with (
            patch("services.school_schedule.mock_data_enabled", return_value=False),
            patch("services.school_schedule._client", return_value=client),
            patch(
                "services.school_schedule._execute",
                side_effect=[
                    SimpleNamespace(data=years),
                    SimpleNamespace(data=schedules),
                ],
            ),
        ):
            assignments = get_teacher_schedule_assignments("teacher-1")

        self.assertEqual(
            {(item["grade"], item["section"], item["subject"]) for item in assignments},
            {(10, "А", "Математик"), (10, "Б", "Математик")},
        )
        self.assertTrue(all(item["start_date"] == "2026-09-01" for item in assignments))

    def test_teacher_evaluation_must_match_scheduled_class_subject_and_date(self):
        assignment = {
            "academic_year": "2026-2027",
            "start_date": "2026-09-01",
            "end_date": "2027-06-30",
            "grade": 10,
            "section": "А",
            "subject": "Математик",
        }
        with patch("services.school_schedule.get_teacher_schedule_assignments", return_value=[assignment]):
            validate_teacher_schedule_assignment("teacher-1", date(2026, 11, 21), 10, "А", "Математик")
            for evaluation_date, grade, section, subject in (
                (date(2027, 7, 1), 10, "А", "Математик"),
                (date(2026, 11, 21), 10, "Б", "Математик"),
                (date(2026, 11, 21), 10, "А", "Физик"),
            ):
                with self.subTest(evaluation_date=evaluation_date, grade=grade, section=section, subject=subject):
                    with self.assertRaises(HTTPException) as raised:
                        validate_teacher_schedule_assignment(
                            "teacher-1",
                            evaluation_date,
                            grade,
                            section,
                            subject,
                        )
                    self.assertEqual(raised.exception.status_code, 422)

    def test_school_timetable_rejects_scheduled_row_without_teacher_name(self):
        file = self._timetable_file([
            ("Математик", "Б. Болд", "6а", {1: "6а"}, {}),
            ("", "", "", {}, {1: "7в"}),
        ])

        with self.assertRaises(HTTPException) as raised:
            _parse_schedule_rows(file, self._timetable_profiles())

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("9-р мөр: багшийн нэр хоосон", raised.exception.detail)

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
