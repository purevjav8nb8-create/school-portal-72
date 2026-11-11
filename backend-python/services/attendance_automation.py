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
    metadata = user.user_metadata or {}
    app_metadata = user.app_metadata or {}
    email = (user.email or "").lower()
    return (
        app_metadata.get("role") not in {"admin", "manager"}
        and email != admin_email
        and (metadata.get("role") == "teacher" or email.endswith("@moes.edu.mn"))
    )


def ensure_today_attendance() -> None:
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
        return

    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн жагсаалтыг Supabase-ээс уншиж чадсангүй.") from error

    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for user in users:
        if not _is_teacher(user, admin_email):
            continue
        app_metadata = user.app_metadata or {}
        records = app_metadata.get("teacher_attendance", [])
        if any(item.get("date") == today for item in records):
            continue
        try:
            supabase.auth.admin.update_user_by_id(
                user.id,
                {"app_metadata": {
                    **app_metadata,
                    "teacher_attendance": [*records, {"date": today, "status": "Ирсэн"}],
                }},
            )
        except Exception as error:
            raise HTTPException(status_code=503, detail="Өнөөдрийн ирцийн бүртгэл үүсгэсэнгүй.") from error
