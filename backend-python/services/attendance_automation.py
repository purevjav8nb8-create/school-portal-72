import os
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from database import supabase
from services.mock_school_data import (
    load_mock_school_data,
    mock_data_enabled,
    update_mock_teacher_attendance,
)

SCHOOL_TIMEZONE = ZoneInfo("Asia/Ulaanbaatar")


def school_today() -> date:
    return datetime.now(SCHOOL_TIMEZONE).date()


def _is_teacher(user: Any, admin_email: str) -> bool:
    if isinstance(user, dict):
        return user.get("role") == "teacher"
    metadata = user.user_metadata or {}
    app_metadata = user.app_metadata or {}
    email = (user.email or "").lower()
    return (
        app_metadata.get("role") not in {"admin", "manager"}
        and email != admin_email
        and (metadata.get("role") == "teacher" or email.endswith("@moes.edu.mn"))
    )


def has_teacher_identity(user: Any) -> bool:
    if isinstance(user, dict):
        metadata = user
        email = user.get("email")
    else:
        metadata = user.user_metadata or {}
        email = user.email
    return any(str(value or "").strip() for value in (
        email,
        metadata.get("last_name"),
        metadata.get("first_name"),
    ))


def _default_workdays(start: date, end: date, public_holidays: set[date]) -> list[date]:
    if end < start:
        return []
    return [
        start + timedelta(days=offset)
        for offset in range((end - start).days + 1)
        if (start + timedelta(days=offset)).weekday() < 5
        and (start + timedelta(days=offset)) not in public_holidays
    ]


def ensure_today_attendance(users: list[Any] | None = None) -> list[Any] | None:
    today = school_today()
    today_text = today.isoformat()
    month_start = today.replace(day=1)
    if mock_data_enabled():
        try:
            public_holidays: set[date] = set()
            workdays = _default_workdays(month_start, today, public_holidays)
            for teacher in load_mock_school_data()["teachers"]:
                if not has_teacher_identity(teacher):
                    continue
                records = teacher.get("attendance", [])
                recorded_dates = {str(item.get("date") or "")[:10] for item in records}
                for workday in workdays:
                    if workday.isoformat() not in recorded_dates:
                        update_mock_teacher_attendance(
                            teacher["auth_id"],
                            {"date": workday.isoformat(), "status": "Ирсэн"},
                        )
        except (KeyError, RuntimeError) as error:
            raise HTTPException(status_code=503, detail="Өнөөдрийн ирцийн бүртгэл үүсгэсэнгүй.") from error
        return None

    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    if users is None:
        try:
            from services.teacher_portal_storage import list_teacher_profiles

            users = list_teacher_profiles()
        except Exception as error:
            raise HTTPException(status_code=503, detail="Багшийн жагсаалтыг Supabase-ээс уншиж чадсангүй.") from error

    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    teacher_ids = []
    for user in users:
        if not _is_teacher(user, admin_email) or not has_teacher_identity(user):
            continue
        teacher_id = str(user.get("user_id") or user.get("id") or "") if isinstance(user, dict) else str(user.id)
        if teacher_id:
            teacher_ids.append(teacher_id)
    if not teacher_ids:
        return users
    try:
        year_result = (
            supabase.table("school_academic_years")
            .select("start_date,end_date")
            .lte("start_date", today_text)
            .gte("end_date", today_text)
            .order("start_date", desc=True)
            .execute()
        )
        year_rows = year_result.data or []
        if year_rows:
            range_start = date.fromisoformat(str(year_rows[0]["start_date"])[:10])
        else:
            range_start = month_start

        holiday_result = (
            supabase.table("school_public_holidays")
            .select("holiday_date")
            .gte("holiday_date", range_start.isoformat())
            .lte("holiday_date", today_text)
            .execute()
        )
        public_holidays = {
            date.fromisoformat(str(item["holiday_date"])[:10])
            for item in (holiday_result.data or [])
        }
        workdays = _default_workdays(range_start, today, public_holidays)
        existing = (
            supabase.table("teacher_attendance")
            .select("teacher_id,attendance_date,status")
            .gte("attendance_date", range_start.isoformat())
            .lte("attendance_date", today_text)
            .in_("teacher_id", teacher_ids)
            .execute()
        )
        already_recorded = {
            (str(item["teacher_id"]), str(item["attendance_date"])[:10])
            for item in (existing.data or [])
        }
        rows = [
            {
                "teacher_id": teacher_id,
                "attendance_date": workday.isoformat(),
                "status": "Ирсэн",
            }
            for teacher_id in teacher_ids
            for workday in workdays
            if (teacher_id, workday.isoformat()) not in already_recorded
        ]
        if rows:
            supabase.table("teacher_attendance").upsert(
                rows,
                on_conflict="teacher_id,attendance_date",
                ignore_duplicates=True,
            ).execute()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Өнөөдрийн ирцийн бүртгэл үүсгэсэнгүй.") from error
    return users
