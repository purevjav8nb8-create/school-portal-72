import calendar
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO
import re
from types import SimpleNamespace
from typing import Any

from fastapi import HTTPException, UploadFile
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from database import supabase
from schemas.teachers import AcademicYearUpdate, SubstituteHoursUpdate
from services.teacher_portal_storage import list_teacher_profiles, replace_portal_collection
from services.mock_school_data import get_mock_teacher_by_id, mock_data_enabled


_YEAR_TABLE = "school_academic_years"
_SCHEDULE_TABLE = "school_teacher_schedules"
_SUBSTITUTE_TABLE = "school_substitute_hours"
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_WEEKDAYS = {
    "1": 1, "monday": 1, "mon": 1, "даваа": 1, "да": 1,
    "2": 2, "tuesday": 2, "tue": 2, "мягмар": 2, "мя": 2,
    "3": 3, "wednesday": 3, "wed": 3, "лхагва": 3, "лх": 3,
    "4": 4, "thursday": 4, "thu": 4, "пүрэв": 4, "пү": 4,
    "5": 5, "friday": 5, "fri": 5, "баасан": 5, "ба": 5,
}
_WEEK_TYPES = {
    "all": "all", "every": "all", "бүх": "all", "бүгд": "all", "тогтмол": "all",
    "even": "even", "тэгш": "even",
    "odd": "odd", "сондгой": "odd",
}
_COLUMN_ALIASES = {
    "teacher_email": {"teacheremail", "email", "moesemail", "багшийнmoesимэйл", "багшийнмэйл", "имэйл"},
    "grade": {"grade", "анги", "ангийндугаар"},
    "section": {"section", "бүлэг"},
    "subject": {"subject", "хичээл", "судлагдахуун", "мэргэжил"},
    "weekday": {"weekday", "day", "гараг", "өдөр"},
    "week_type": {"weektype", "parity", "долоохоногийнтөрөл", "7хоногийнтөрөл"},
    "lesson_number": {"lessonnumber", "period", "periodnumber", "цагийндугаар", "хичээлийнцаг"},
}
_TEACHER_NAME_HEADERS = {"teachername", "fullname", "багш", "багшнарыннэр"}
_HOMEROOM_HEADERS = {"homeroom", "даасанг", "даасананги"}
_MATRIX_DAY_HEADERS = {
    "даваа": 1,
    "мягмар": 2,
    "лхагва": 3,
    "пүрэв": 4,
    "баасан": 5,
}
_REQUIRED_COLUMNS = set(_COLUMN_ALIASES)
_VALID_SECTIONS = {"А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "С"}
_TIMETABLE_PERIODS_PER_SHIFT = 7
_TIMETABLE_SHIFTS = 2


def _client():
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    return supabase


def _execute(query, detail: str):
    try:
        return query.execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail=detail) from error


def _normalized_header(value: Any) -> str:
    return re.sub(r"[\W_]+", "", str(value or "").strip().casefold(), flags=re.UNICODE)


def list_academic_years() -> list[dict[str, Any]]:
    result = _execute(
        _client().table(_YEAR_TABLE).select(
            "academic_year,start_date,end_date,terms,updated_at"
        ).order("start_date", desc=True),
        "Хичээлийн жилийн жагсаалтыг уншиж чадсангүй.",
    )
    return result.data or []


def _get_academic_year(academic_year: str) -> dict[str, Any]:
    result = _execute(
        _client().table(_YEAR_TABLE).select(
            "academic_year,start_date,end_date,terms"
        ).eq("academic_year", academic_year),
        "Хичээлийн жилийн бүтцийг уншиж чадсангүй.",
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Хичээлийн жил бүртгэгдээгүй байна.")
    return rows[0]


def save_academic_year(structure: AcademicYearUpdate, user: Any) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "academic_year": structure.academic_year,
        "start_date": structure.start_date.isoformat(),
        "end_date": structure.end_date.isoformat(),
        "terms": [term.model_dump(mode="json") for term in structure.terms],
        "created_by": str(user.id),
        "updated_at": now,
    }
    _execute(
        _client().table(_YEAR_TABLE).upsert(record, on_conflict="academic_year"),
        "Хичээлийн жилийн бүтцийг хадгалж чадсангүй.",
    )
    return record


def delete_academic_year(academic_year: str) -> None:
    _get_academic_year(academic_year)
    _execute(
        _client().table(_YEAR_TABLE).delete().eq("academic_year", academic_year),
        "Хичээлийн жилийг устгаж чадсангүй.",
    )


def create_schedule_template(academic_year: str | None = None) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Хуваарь"
    sheet["A1"] = "БАГШИЙН ХИЧЭЭЛИЙН ХУВААРЬ"
    sheet["A2"] = "Нэг мөрөнд нэг хичээлийг бүртгэнэ. Багшийн MOES имэйлээр танина. Долоо хоногт 19 цагийн нормыг автоматаар ашиглана."
    if academic_year:
        sheet["A3"] = f"Хичээлийн жил: {academic_year}"
    headers = [
        "Багшийн MOES имэйл",
        "Анги",
        "Бүлэг",
        "Хичээл",
        "Гараг",
        "Долоо хоногийн төрөл",
        "Цагийн дугаар",
    ]
    for column, header in enumerate(headers, start=1):
        sheet.cell(row=4, column=column, value=header)
        sheet.cell(row=4, column=column).font = Font(bold=True)
    sheet.freeze_panes = "A5"
    sheet.auto_filter.ref = "A4:G4"
    for column, width in enumerate([32, 12, 12, 22, 16, 24, 16], start=1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    weekday_validation = DataValidation(type="list", formula1='"Даваа,Мягмар,Лхагва,Пүрэв,Баасан"', allow_blank=True)
    week_validation = DataValidation(type="list", formula1='"Бүх,Тэгш,Сондгой"', allow_blank=True)
    sheet.add_data_validation(weekday_validation)
    sheet.add_data_validation(week_validation)
    weekday_validation.add("E5:E1004")
    week_validation.add("F5:F1004")

    guide = workbook.create_sheet("Заавар")
    guide.append(["БАГАНА", "УТГА"])
    guide.append(["Багшийн MOES имэйл", "Системд бүртгэлтэй багшийн нэвтрэх имэйлтэй яг тааруулна."])
    guide.append(["Анги", "1-12 бүхэл тоо."])
    guide.append(["Бүлэг", "А, Б, В, Г, Д, Е, Ё, Ж эсвэл З."])
    guide.append(["Хичээл", "Заах хичээлийн нэр."])
    guide.append(["Гараг", "Даваа, Мягмар, Лхагва, Пүрэв эсвэл Баасан."])
    guide.append(["Долоо хоногийн төрөл", "Бүх (тогтмол), Тэгш эсвэл Сондгой. Эхний хичээлийн долоо хоног Сондгойгоос эхэлнэ."])
    guide.append(["Цагийн дугаар", "Тухайн өдрийн 1-14 дэх цаг. Нэг багш нэг цагт давхар хуваарьтай байж болохгүй."])
    guide.append(["Норм", "Багш бүрийн долоо хоногийн норм 19 цаг. Нормын баганыг бөглөх шаардлагагүй."])
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _as_integer(value: Any, label: str, row_number: int, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{label} бүхэл тоо байх ёстой.")
    try:
        number = Decimal(str(value).strip())
    except Exception as error:
        raise ValueError(f"{label} бүхэл тоо байх ёстой.") from error
    if not number.is_finite() or number != number.to_integral_value() or number < minimum or number > maximum:
        raise ValueError(f"{label} {minimum}-{maximum}-ын хооронд бүхэл тоо байна.")
    return int(number)


def _parse_normalized_schedule_rows(
    sheet,
    profiles: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    header_row = None
    column_map: dict[str, int] = {}
    for row_number, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
        headers = {_normalized_header(value): index for index, value in enumerate(row)}
        found = {
            field: next((headers[alias] for alias in aliases if alias in headers), None)
            for field, aliases in _COLUMN_ALIASES.items()
        }
        if all(index is not None for index in found.values()):
            header_row = row_number
            column_map = {field: int(index) for field, index in found.items() if index is not None}
            break
    if header_row is None:
        return None

    teacher_by_email = {
        str(profile.get("email", "")).strip().casefold(): profile
        for profile in profiles
        if profile.get("role") == "teacher" and profile.get("email")
    }
    lessons: list[dict[str, Any]] = []
    failures: list[str] = []
    occupied_slots: dict[tuple[str, int, int], set[str]] = defaultdict(set)
    for row_number, row in enumerate(
        sheet.iter_rows(min_row=header_row + 1, values_only=True),
        start=header_row + 1,
    ):
        if not any(value is not None and str(value).strip() for value in row):
            continue
        try:
            values = {
                field: row[index] if index < len(row) else None
                for field, index in column_map.items()
            }
            email = str(values["teacher_email"] or "").strip().casefold()
            teacher = teacher_by_email.get(email)
            if teacher is None:
                raise ValueError("MOES имэйл бүртгэлтэй багштай таарахгүй байна.")
            grade = _as_integer(values["grade"], "Анги", row_number, 1, 12)
            section = str(values["section"] or "").strip().upper()
            if section not in _VALID_SECTIONS:
                raise ValueError("Бүлгийн утга буруу байна.")
            subject = str(values["subject"] or "").strip()
            if not subject or len(subject) > 120:
                raise ValueError("Хичээлийн нэр хоосон эсвэл 120 тэмдэгтээс урт байна.")
            weekday_key = str(values["weekday"] or "").strip().casefold()
            weekday = _WEEKDAYS.get(weekday_key)
            if weekday is None:
                raise ValueError("Гараг Даваа-Баасан байх ёстой.")
            week_key = str(values["week_type"] or "").strip().casefold()
            week_type = _WEEK_TYPES.get(week_key)
            if week_type is None:
                raise ValueError("Долоо хоногийн төрөл Бүх, Тэгш эсвэл Сондгой байна.")
            lesson_number = _as_integer(values["lesson_number"], "Цагийн дугаар", row_number, 1, 14)
            teacher_id = str(teacher["user_id"])
            slot_key = (teacher_id, weekday, lesson_number)
            existing_types = occupied_slots[slot_key]
            if "all" in existing_types or (week_type == "all" and existing_types) or week_type in existing_types:
                raise ValueError("Багш нэг цагт давхар хуваарьтай байна.")
            existing_types.add(week_type)
            lessons.append({
                "teacher_id": teacher_id,
                "teacher_email": email,
                "teacher_name": " ".join(
                    part for part in (str(teacher.get("last_name") or "").strip(), str(teacher.get("first_name") or "").strip())
                    if part
                ),
                "grade": grade,
                "section": section,
                "subject": subject,
                "weekday": weekday,
                "week_type": week_type,
                "lesson_number": lesson_number,
            })
        except Exception as error:
            failures.append(f"{row_number}-р мөр: {error}")
            if len(failures) >= 30:
                failures.append("Алдааны эхний 30 мөрийг харуулав.")
                break

    if failures:
        raise HTTPException(status_code=422, detail="\n".join(failures))
    if not lessons:
        raise HTTPException(status_code=422, detail="Файлд импортлох хуваарийн мөр алга.")
    return lessons


def _teacher_name_key(value: Any) -> str:
    return re.sub(r"[\W_]+", "", str(value or "").strip().casefold(), flags=re.UNICODE)


def _teacher_name_index(profiles: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for profile in profiles:
        if profile.get("role") != "teacher":
            continue
        last_name = str(profile.get("last_name") or "").strip()
        first_name = str(profile.get("first_name") or "").strip()
        variants = {
            f"{last_name} {first_name}",
            f"{last_name[:1]} {first_name}" if last_name else "",
            f"{first_name} {last_name}",
        }
        for variant in variants:
            key = _teacher_name_key(variant)
            if key and profile not in index[key]:
                index[key].append(profile)
    return index


def _find_timetable_header(
    sheet,
) -> tuple[int, int, int, int, int, list[tuple[int, int]]] | None:
    for row_number, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
        headers = {_normalized_header(value): index for index, value in enumerate(row)}
        subject_column = next(
            (headers[alias] for alias in _COLUMN_ALIASES["subject"] if alias in headers),
            None,
        )
        teacher_column = next(
            (headers[alias] for alias in _TEACHER_NAME_HEADERS if alias in headers),
            None,
        )
        homeroom_column = next(
            (headers[alias] for alias in _HOMEROOM_HEADERS if alias in headers),
            None,
        )
        row_number_column = next(
            (
                index for index, value in enumerate(row)
                if str(value or "").strip() == "№"
                or _normalized_header(value) in {"no", "number", "дугаар"}
            ),
            None,
        )
        day_columns: dict[int, int] = {}
        for column, value in enumerate(row):
            weekday = _MATRIX_DAY_HEADERS.get(_normalized_header(value))
            if weekday and weekday not in day_columns:
                day_columns[weekday] = column
        if (
            subject_column is None
            or teacher_column is None
            or homeroom_column is None
            or row_number_column is None
            or sorted(day_columns) != [1, 2, 3, 4, 5]
        ):
            continue
        ordered_days = sorted(day_columns.items())
        period_count = _TIMETABLE_PERIODS_PER_SHIFT * _TIMETABLE_SHIFTS
        if any(
            ordered_days[index + 1][1] - start != period_count
            for index, (_, start) in enumerate(ordered_days[:-1])
        ):
            continue
        return (
            row_number,
            int(subject_column),
            int(teacher_column),
            int(homeroom_column),
            int(row_number_column),
            ordered_days,
        )
    return None


def _parse_timetable_class(value: Any, allow_combined_sections: bool = False) -> tuple[int, str]:
    match = re.fullmatch(r"\s*(1[0-2]|[1-9])\s*([А-ЯӨҮЁ]+)\s*", str(value or "").strip().upper())
    if not match:
        raise ValueError("Анги, бүлгийн утга буруу байна.")
    grade = int(match.group(1))
    section = match.group(2)
    if any(letter not in _VALID_SECTIONS for letter in section):
        raise ValueError("Бүлгийн утга буруу байна.")
    if not allow_combined_sections and len(section) != 1:
        raise ValueError("Даасан ангийн бүлэг нэг үсэг байна.")
    return grade, section


def _parse_timetable_sheet(
    sheet,
    profiles: list[dict[str, Any]],
) -> dict[str, Any] | None:
    header = _find_timetable_header(sheet)
    if header is None:
        return None
    header_row, subject_column, teacher_column, homeroom_column, row_number_column, day_columns = header
    teacher_index = _teacher_name_index(profiles)
    failures: list[str] = []
    lessons: list[dict[str, Any]] = []
    homerooms: dict[str, list[dict[str, Any]]] = {}
    teacher_profiles: dict[str, dict[str, Any]] = {}
    occupied_slots: set[tuple[str, int, int]] = set()
    previous_subject = ""
    record_count = 0
    first_data_row = header_row + 3

    for row_number, row in enumerate(sheet.iter_rows(min_row=first_data_row, values_only=True), start=first_data_row):
        raw_row_number = row[row_number_column] if row_number_column < len(row) else None
        if raw_row_number is None or not str(raw_row_number).strip():
            break
        try:
            _as_integer(raw_row_number, "Дугаар", row_number, 1, 10000)
        except ValueError:
            break
        raw_name = row[teacher_column] if teacher_column < len(row) else None
        teacher_name = str(raw_name or "").strip()
        raw_subject = row[subject_column] if subject_column < len(row) else None
        if raw_subject is not None and str(raw_subject).strip():
            previous_subject = str(raw_subject).strip()
        raw_homeroom = row[homeroom_column] if homeroom_column < len(row) else None
        slot_values = [
            (weekday, period_index + 1, row[start + period_index])
            for weekday, start in day_columns
            for period_index in range(_TIMETABLE_PERIODS_PER_SHIFT * _TIMETABLE_SHIFTS)
            if start + period_index < len(row)
            and row[start + period_index] is not None
            and str(row[start + period_index]).strip()
        ]
        if not teacher_name and not slot_values and not (raw_homeroom and str(raw_homeroom).strip()):
            continue
        record_count += 1
        if not teacher_name:
            failures.append(f"{row_number}-р мөр: багшийн нэр хоосон байна.")
            if len(failures) >= 30:
                failures.append("Алдааны эхний 30 мөрийг харуулав.")
                break
            continue

        candidates = teacher_index.get(_teacher_name_key(teacher_name), [])
        unique_candidates = {str(item.get("user_id") or ""): item for item in candidates}
        if len(unique_candidates) != 1 or not next(iter(unique_candidates), ""):
            detail = (
                "багшийн нэр хэд хэдэн бүртгэлтэй таарлаа."
                if unique_candidates
                else "багшийн нэр бүртгэлтэй багштай таарахгүй байна."
            )
            failures.append(f"{row_number}-р мөр: {detail}")
            if len(failures) >= 30:
                failures.append("Алдааны эхний 30 мөрийг харуулав.")
                break
            continue

        teacher_id, teacher = next(iter(unique_candidates.items()))
        teacher_profiles[teacher_id] = teacher
        homerooms.setdefault(teacher_id, [])
        if raw_homeroom is not None and str(raw_homeroom).strip():
            try:
                grade, section = _parse_timetable_class(raw_homeroom)
                homeroom = {"grade": grade, "section": section, "weekly_hours": 0, "homeroom": True}
                if homeroom not in homerooms[teacher_id]:
                    homerooms[teacher_id].append(homeroom)
                if len(homerooms[teacher_id]) > 5:
                    raise ValueError("Даасан анги 5-аас их байж болохгүй.")
            except Exception as error:
                failures.append(f"{row_number}-р мөр: {error}")
                continue

        subject = previous_subject
        if slot_values and (not subject or len(subject) > 120):
            failures.append(f"{row_number}-р мөр: багшийн заах хичээл тодорхойгүй байна.")
            continue
        for weekday, lesson_number, class_value in slot_values:
            try:
                grade, section = _parse_timetable_class(class_value, allow_combined_sections=True)
                slot_key = (teacher_id, weekday, lesson_number)
                if slot_key in occupied_slots:
                    raise ValueError("Багш нэг цагт давхар хуваарьтай байна.")
                occupied_slots.add(slot_key)
                lessons.append({
                    "teacher_id": teacher_id,
                    "teacher_email": str(teacher.get("email") or "").strip().casefold(),
                    "teacher_name": " ".join(
                        part for part in (
                            str(teacher.get("last_name") or "").strip(),
                            str(teacher.get("first_name") or "").strip(),
                        ) if part
                    ),
                    "grade": grade,
                    "section": section,
                    "subject": subject,
                    "weekday": weekday,
                    "week_type": "all",
                    "lesson_number": lesson_number,
                })
            except Exception as error:
                failures.append(f"{row_number}-р мөр: {error}")
                if len(failures) >= 30:
                    failures.append("Алдааны эхний 30 мөрийг харуулав.")
                    break
        if len(failures) >= 30:
            break

    return {
        "record_count": record_count,
        "lessons": lessons,
        "homerooms": homerooms,
        "teacher_profiles": teacher_profiles,
        "failures": failures,
    }


def _load_schedule_workbook(file: UploadFile):
    suffix = (file.filename or "").lower().rsplit(".", 1)[-1]
    if suffix != "xlsx":
        raise HTTPException(status_code=415, detail="Багшийн хуваарийг XLSX файлаар оруулна уу.")
    try:
        file.file.seek(0)
        content = file.file.read(_MAX_UPLOAD_BYTES + 1)
        if len(content) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Хуваарийн файл 10 MB-аас бага байна.")
        return load_workbook(BytesIO(content), data_only=True, read_only=True)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail="XLSX файлыг уншиж чадсангүй.") from error


def _parse_schedule_file(
    file: UploadFile,
    profiles: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]] | None, dict[str, dict[str, Any]]]:
    workbook = _load_schedule_workbook(file)
    for sheet in workbook.worksheets:
        lessons = _parse_normalized_schedule_rows(sheet, profiles)
        if lessons is not None:
            return lessons, None, {}

    candidates = []
    for sheet in workbook.worksheets:
        result = _parse_timetable_sheet(sheet, profiles)
        if result is not None:
            candidates.append(result)
    if not candidates:
        raise HTTPException(
            status_code=422,
            detail="XLSX-д стандарт хуваарийн баганууд эсвэл багшийн нэр, мэргэжил, даасан анги бүхий долоо хоногийн хуваарь олдсонгүй.",
        )
    selected = max(candidates, key=lambda item: (item["record_count"], len(item["lessons"])))
    if selected["failures"]:
        raise HTTPException(status_code=422, detail="\n".join(selected["failures"]))
    if not selected["lessons"]:
        raise HTTPException(status_code=422, detail="Файлд импортлох хуваарийн мөр алга.")
    return selected["lessons"], selected["homerooms"], selected["teacher_profiles"]


def _parse_schedule_rows(file: UploadFile, profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return _parse_schedule_file(file, profiles)[0]


def import_teacher_schedule(academic_year: str, file: UploadFile, user: Any) -> dict[str, Any]:
    _get_academic_year(academic_year)
    profiles = list_teacher_profiles()
    lessons, homerooms, matched_profiles = _parse_schedule_file(file, profiles)
    _execute(
        _client().table(_SCHEDULE_TABLE).upsert(
            {
                "academic_year": academic_year,
                "lessons": lessons,
                "uploaded_by": str(user.id),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="academic_year",
        ),
        "Хуваарийг хадгалж чадсангүй.",
    )
    if homerooms is not None:
        now = datetime.now(timezone.utc).isoformat()
        for teacher_id, classes in homerooms.items():
            profile = matched_profiles[teacher_id]
            teacher_user = SimpleNamespace(
                id=teacher_id,
                email=profile.get("email") or "",
                user_metadata={
                    "last_name": profile.get("last_name") or "",
                    "first_name": profile.get("first_name") or "",
                    "unit": profile.get("unit") or "",
                },
            )
            replace_portal_collection(
                teacher_user,
                "teaching_classes",
                classes,
                updated_at=now,
            )
    return {
        "imported_lessons": len(lessons),
        "teachers": len({item["teacher_id"] for item in lessons}),
        "homeroom_teachers": len(homerooms or {}),
        "homeroom_classes": sum(len(items) for items in (homerooms or {}).values()),
    }


def get_schedule_status(academic_year: str) -> dict[str, Any]:
    _get_academic_year(academic_year)
    result = _execute(
        _client().table(_SCHEDULE_TABLE).select(
            "lessons,updated_at"
        ).eq("academic_year", academic_year),
        "Хуваарийн төлөв уншигдсангүй.",
    )
    rows = result.data or []
    if not rows:
        return {"uploaded": False, "imported_lessons": 0, "teachers": 0, "updated_at": None}
    lessons = rows[0].get("lessons") or []
    return {
        "uploaded": True,
        "imported_lessons": len(lessons),
        "teachers": len({item.get("teacher_id") for item in lessons}),
        "updated_at": rows[0].get("updated_at"),
    }


def get_teacher_schedule_assignments(teacher_id: str) -> list[dict[str, Any]]:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(str(teacher_id))
        return list((teacher or {}).get("teaching_schedule") or [])

    client = _client()
    years_result = _execute(
        client.table(_YEAR_TABLE).select("academic_year,start_date,end_date"),
        "Хичээлийн жилийн жагсаалтыг уншиж чадсангүй.",
    )
    schedules_result = _execute(
        client.table(_SCHEDULE_TABLE).select("academic_year,lessons"),
        "Багшийн хуваарь уншигдсангүй.",
    )
    years = years_result.data or []
    schedules = schedules_result.data or []
    year_by_id = {str(item["academic_year"]): item for item in years}
    assignments: dict[tuple[str, int, str, str], dict[str, Any]] = {}
    for schedule in schedules:
        academic_year = str(schedule.get("academic_year") or "")
        year = year_by_id.get(academic_year)
        if not year:
            continue
        lessons = schedule.get("lessons") or []
        if not isinstance(lessons, list):
            raise HTTPException(status_code=503, detail="Хуваарийн өгөгдлийн формат буруу байна.")
        start_date = str(year.get("start_date") or "")[:10]
        end_date = str(year.get("end_date") or "")[:10]
        for lesson in lessons:
            if not isinstance(lesson, dict) or str(lesson.get("teacher_id") or "") != str(teacher_id):
                continue
            try:
                grade = int(lesson["grade"])
            except (KeyError, TypeError, ValueError) as error:
                raise HTTPException(status_code=503, detail="Хуваарийн ангийн өгөгдөл буруу байна.") from error
            subject = str(lesson.get("subject") or "").strip()
            section_value = str(lesson.get("section") or "").strip().upper()
            if not subject or not section_value or any(section not in _VALID_SECTIONS for section in section_value):
                raise HTTPException(status_code=503, detail="Хуваарийн анги, хичээлийн өгөгдөл буруу байна.")
            for section in section_value:
                assignment = {
                    "academic_year": academic_year,
                    "start_date": start_date,
                    "end_date": end_date,
                    "grade": grade,
                    "section": section,
                    "subject": subject,
                }
                key = (academic_year, grade, section, subject)
                assignments[key] = assignment
    return list(assignments.values())


def validate_teacher_schedule_assignment(
    teacher_id: str,
    evaluation_date: date,
    grade: int,
    section: str,
    subject: str,
) -> None:
    normalized_subject = subject.strip().casefold()
    for assignment in get_teacher_schedule_assignments(teacher_id):
        if (
            assignment["start_date"] <= evaluation_date.isoformat() <= assignment["end_date"]
            and assignment["grade"] == grade
            and assignment["section"] == section
            and assignment["subject"].strip().casefold() == normalized_subject
        ):
            return
    raise HTTPException(
        status_code=422,
        detail="Сонгосон огноо, анги, хичээл таны хуваарьт байхгүй байна.",
    )


def _month_start(month: date) -> date:
    if month.day != 1:
        raise HTTPException(status_code=422, detail="Сарын эхний өдрийг сонгоно уу.")
    return month


def save_substitute_hours(
    academic_year: str,
    month: date,
    submission: SubstituteHoursUpdate,
    user: Any,
) -> dict[str, int]:
    month = _month_start(month)
    school_year = _get_academic_year(academic_year)
    year_start = date.fromisoformat(str(school_year["start_date"])[:10])
    year_end = date.fromisoformat(str(school_year["end_date"])[:10])
    month_end = date(month.year, month.month, calendar.monthrange(month.year, month.month)[1])
    if month > year_end or month_end < year_start:
        raise HTTPException(status_code=422, detail="Сонгосон сар хичээлийн жилийн гадна байна.")

    teacher_ids = {
        str(profile["user_id"])
        for profile in list_teacher_profiles()
        if profile.get("role") == "teacher" and profile.get("user_id")
    }
    entries = [item for item in submission.entries if str(item.teacher_id) in teacher_ids]
    if len(entries) != len(submission.entries):
        raise HTTPException(status_code=422, detail="Зөвхөн бүртгэлтэй багшийн орлон цагийг оруулна уу.")
    now = datetime.now(timezone.utc).isoformat()
    records = [
        {
            "academic_year": academic_year,
            "work_month": month.isoformat(),
            "teacher_id": str(item.teacher_id),
            "hours": float(item.hours),
            "updated_by": str(user.id),
            "updated_at": now,
        }
        for item in entries
    ]
    if records:
        _execute(
            _client().table(_SUBSTITUTE_TABLE).upsert(
                records,
                on_conflict="academic_year,work_month,teacher_id",
            ),
            "Орлон заасан цагийг хадгалж чадсангүй.",
        )
    return {"saved": len(records)}


def _grade_is_active(day: date, grade: int, terms: list[dict[str, Any]]) -> bool:
    return any(
        date.fromisoformat(str(term["start_date"])[:10]) <= day <= date.fromisoformat(str(term["end_date"])[:10])
        and (not term.get("grades") or grade in term["grades"])
        for term in terms
    )


def _calendar_days(month: date) -> list[date]:
    last_day = calendar.monthrange(month.year, month.month)[1]
    return [date(month.year, month.month, day) for day in range(1, last_day + 1)]


def _calculate_teacher_month(
    lessons: list[dict[str, Any]],
    terms: list[dict[str, Any]],
    public_holidays: set[date],
    month: date,
    year_start: date,
    substitute_hours: float,
) -> dict[str, Any]:
    grades = {int(lesson["grade"]) for lesson in lessons}
    active_days = [
        day for day in _calendar_days(month)
        if day.weekday() < 5
        and day not in public_holidays
        and any(_grade_is_active(day, grade, terms) for grade in grades)
    ]
    weekly_hours = {
        week_type: sum(1 for lesson in lessons if lesson["week_type"] == week_type)
        for week_type in ("all", "even", "odd")
    }
    scheduled_hours = 0
    for lesson in lessons:
        for day in active_days:
            if day.weekday() + 1 != int(lesson["weekday"]):
                continue
            if not _grade_is_active(day, int(lesson["grade"]), terms):
                continue
            week_number = ((day - year_start).days // 7) + 1
            week_type = "odd" if week_number % 2 else "even"
            if lesson["week_type"] == "all" or lesson["week_type"] == week_type:
                scheduled_hours += 1

    counted_substitute_hours = substitute_hours if active_days else 0
    norm_hours = (19 / 5) * len(active_days)
    actual_hours = scheduled_hours + counted_substitute_hours
    return {
        "weekly_base_hours": weekly_hours["all"],
        "weekly_even_hours": weekly_hours["even"],
        "weekly_odd_hours": weekly_hours["odd"],
        "active_workdays": len(active_days),
        "scheduled_hours": round(scheduled_hours, 2),
        "substitute_hours": round(substitute_hours, 2),
        "actual_hours": round(actual_hours, 2),
        "norm_hours": round(norm_hours, 2),
        "overtime_hours": round(max(0, actual_hours - norm_hours), 2),
    }


def calculate_monthly_overtime(academic_year: str, month: date) -> dict[str, Any]:
    month = _month_start(month)
    school_year = _get_academic_year(academic_year)
    year_start = date.fromisoformat(str(school_year["start_date"])[:10])
    year_end = date.fromisoformat(str(school_year["end_date"])[:10])
    month_end = date(month.year, month.month, calendar.monthrange(month.year, month.month)[1])
    if month > year_end or month_end < year_start:
        raise HTTPException(status_code=422, detail="Сонгосон сар хичээлийн жилийн гадна байна.")

    schedule_result = _execute(
        _client().table(_SCHEDULE_TABLE).select("lessons")
        .eq("academic_year", academic_year),
        "Багшийн хуваарь уншигдсангүй.",
    )
    schedule_rows = schedule_result.data or []
    if not schedule_rows:
        raise HTTPException(status_code=409, detail="Энэ хичээлийн жилийн хуваарийг эхлээд XLSX-ээр оруулна уу.")
    lessons = schedule_rows[0].get("lessons") or []
    terms = school_year.get("terms") or []

    holiday_result = _execute(
        _client().table("school_public_holidays").select("holiday_date")
        .gte("holiday_date", month.isoformat())
        .lte("holiday_date", month_end.isoformat()),
        "Бүх нийтийн амралтын өдрүүд уншигдсангүй.",
    )
    public_holidays = {
        date.fromisoformat(str(item["holiday_date"])[:10])
        for item in (holiday_result.data or [])
    }

    teacher_lessons: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for lesson in lessons:
        teacher_lessons[str(lesson["teacher_id"])].append(lesson)
    substitute_result = _execute(
        _client().table(_SUBSTITUTE_TABLE).select("teacher_id,hours")
        .eq("academic_year", academic_year)
        .eq("work_month", month.isoformat()),
        "Орлон заасан цаг уншигдсангүй.",
    )
    substitute_by_teacher = {
        str(item["teacher_id"]): float(item.get("hours") or 0)
        for item in (substitute_result.data or [])
    }

    report = []
    for teacher in list_teacher_profiles():
        if teacher.get("role") != "teacher":
            continue
        teacher_id = str(teacher.get("user_id") or "")
        own_lessons = teacher_lessons.get(teacher_id, [])
        if not teacher_id:
            continue
        hours = _calculate_teacher_month(
            own_lessons,
            terms,
            public_holidays,
            month,
            year_start,
            substitute_by_teacher.get(teacher_id, 0),
        )
        report.append({
            "teacher_id": teacher_id,
            "teacher_name": " ".join(
                part for part in (str(teacher.get("last_name") or "").strip(), str(teacher.get("first_name") or "").strip())
                if part
            ),
            "email": str(teacher.get("email") or ""),
            "weekly_norm": 19,
            **hours,
        })

    report.sort(key=lambda item: (item["teacher_name"].casefold(), item["email"].casefold()))
    return {
        "academic_year": academic_year,
        "month": month.isoformat()[:7],
        "first_week_type": "odd",
        "teachers": report,
    }
