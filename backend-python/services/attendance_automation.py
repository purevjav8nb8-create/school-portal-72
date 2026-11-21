import os
from datetime import date, datetime
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


def ensure_today_attendance(users: list[Any] | None = None) -> list[Any] | None:
    today = school_today().isoformat()
    if mock_data_enabled():
        try:
            for teacher in load_mock_school_data()["teachers"]:
                if not has_teacher_identity(teacher):
                    continue
                records = teacher.get("attendance", [])
                if not any(item.get("date") == today for item in records):
                    update_mock_teacher_attendance(
                        teacher["auth_id"], {"date": today, "status": "Ирсэн"}
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
        existing = (
            supabase.table("teacher_attendance")
            .select("teacher_id")
            .eq("attendance_date", today)
            .in_("teacher_id", teacher_ids)
            .execute()
        )
        already_recorded = {item["teacher_id"] for item in (existing.data or [])}
        rows = [
            {"teacher_id": teacher_id, "attendance_date": today, "status": "Ирсэн"}
            for teacher_id in teacher_ids
            if teacher_id not in already_recorded
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
