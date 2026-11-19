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


def ensure_today_attendance(users: list[Any] | None = None) -> list[Any] | None:
    today = school_today().isoformat()
    if mock_data_enabled():
        try:
            for teacher in load_mock_school_data()["teachers"]:
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
        if not _is_teacher(user, admin_email):
            continue
        teacher_ids.append(str(user["user_id"] if isinstance(user, dict) else user.id))
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
