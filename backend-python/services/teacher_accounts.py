import os
import secrets
from typing import Any

from fastapi import HTTPException
from supabase_auth.types import AdminUserAttributes

from database import supabase
from schemas.teachers import TeacherCreate, TeacherUpdate, VALID_UNITS
from services.mock_school_data import load_mock_school_data, mock_data_enabled


def create_teacher_account(teacher: TeacherCreate) -> dict[str, Any]:
    email = teacher.email.strip().lower()
    local_part, separator, domain = email.partition("@")
    if not local_part or not separator or email.count("@") != 1 or domain != "moes.edu.mn":
        raise HTTPException(status_code=422, detail="Багшийн @moes.edu.mn и-мэйл хаяг шаардлагатай.")
    if teacher.unit not in VALID_UNITS:
        raise HTTPException(status_code=422, detail=f"Нэгж буруу байна: {teacher.unit}")

    password = teacher.password or secrets.token_urlsafe(18)
    metadata = {
        "first_name": teacher.first_name.strip(),
        "last_name": teacher.last_name.strip(),
        "unit": teacher.unit,
        "subject": teacher.subject.strip(),
        "role": "teacher",
    }
    attributes: AdminUserAttributes = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": metadata,
        "app_metadata": {"role": "teacher"},
    }
    try:
        created_user = supabase.auth.admin.create_user(attributes).user
    except Exception as error:
        if getattr(error, "status", None) in {401, 403}:
            raise HTTPException(
                status_code=503,
                detail="Supabase service-role key эрхгүй байна. SUPABASE_SERVICE_ROLE_KEY тохиргоог шалгана уу.",
            ) from error
        if getattr(error, "code", None) == "email_exists":
            raise HTTPException(status_code=409, detail=f"{email} хаягтай хэрэглэгч аль хэдийн байна.") from error
        raise HTTPException(status_code=409, detail=f"{email} хэрэглэгч үүссэнгүй.") from error
    created = {**metadata, "auth_id": created_user.id, "email": email}
    if teacher.password is None:
        created["password"] = password
    return created


def update_teacher_account(user_id: str, teacher: TeacherUpdate) -> dict[str, Any]:
    if teacher.unit not in VALID_UNITS:
        raise HTTPException(status_code=422, detail=f"Нэгж буруу байна: {teacher.unit}")
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        user = supabase.auth.admin.update_user_by_id(user_id, {
            "user_metadata": {
                **(supabase.auth.admin.get_user_by_id(user_id).user.user_metadata or {}),
                "first_name": teacher.first_name.strip(),
                "last_name": teacher.last_name.strip(),
                "unit": teacher.unit,
                "subject": teacher.subject.strip(),
                "role": "teacher",
            },
        }).user
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн мэдээллийг шинэчилж чадсангүй.") from error
    metadata = user.user_metadata or {}
    return {
        "auth_id": user.id,
        "first_name": metadata.get("first_name", ""),
        "last_name": metadata.get("last_name", ""),
        "email": user.email or "",
        "unit": metadata.get("unit", ""),
        "subject": metadata.get("subject", ""),
    }


def delete_teacher_account(user_id: str) -> None:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        user = supabase.auth.admin.get_user_by_id(user_id).user
        if (user.app_metadata or {}).get("role") == "admin":
            raise HTTPException(status_code=403, detail="Админ хэрэглэгчийг устгах боломжгүй.")
        supabase.auth.admin.delete_user(user_id)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийг устгаж чадсангүй.") from error


def list_teacher_accounts() -> list[dict[str, Any]]:
    if mock_data_enabled():
        return [
            {
                "id": index,
                "auth_id": teacher["auth_id"],
                "last_name": teacher["last_name"],
                "first_name": teacher["first_name"],
                "email": teacher["email"],
                "unit": teacher["unit"],
                "subject": teacher["subject"],
                "attendance": max(
                    teacher.get("attendance", []),
                    key=lambda item: item.get("date", ""),
                    default={"status": "Ирсэн"},
                ).get("status", "Ирсэн"),
                "monthly_attendance_rate": 0,
                "training_status": "Хамрагдаагүй",
                "training_records": [],
                "evaluation_records": [],
                "rating": 0,
                "monthly_login_count": 0,
                "teaching_classes": teacher.get("teaching_classes", []),
                "weekly_teaching_hours": sum(
                    item.get("weekly_hours", 0) for item in teacher.get("teaching_classes", [])
                ),
                "overtime_hours": max(
                    0,
                    sum(item.get("weekly_hours", 0) for item in teacher.get("teaching_classes", [])) - 19,
                ),
                "lms_username": "",
                "daily_records": teacher.get("attendance", []),
            }
            for index, teacher in enumerate(load_mock_school_data()["teachers"], start=1)
        ]
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн жагсаалтыг Supabase-ээс уншиж чадсангүй.") from error

    teachers = []
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for user in users:
        metadata = user.user_metadata or {}
        app_metadata = user.app_metadata or {}
        email = (user.email or "").lower()
        if app_metadata.get("role") == "admin" or email == admin_email:
            continue
        if metadata.get("role") != "teacher" and not email.endswith("@moes.edu.mn"):
            continue
        portal = metadata.get("teacher_portal", {})
        attendance_records = (user.app_metadata or {}).get("teacher_attendance", [])
        latest_attendance = max(attendance_records, key=lambda item: item.get("date", ""), default={})
        weekly_hours = sum(item.get("weekly_hours", 0) for item in portal.get("teaching_classes", []))
        latest_month = max((item.get("date", "")[:7] for item in attendance_records), default="")
        month_records = [item for item in attendance_records if item.get("date", "").startswith(latest_month)]
        monthly_rate = round(
            sum(item.get("status") == "Ирсэн" for item in month_records) / len(month_records) * 100
        ) if month_records else 0
        teachers.append({
            "id": len(teachers) + 1,
            "auth_id": user.id,
            "last_name": metadata.get("last_name", ""),
            "first_name": metadata.get("first_name", ""),
            "email": user.email or "",
            "unit": metadata.get("unit", "БАЗАН"),
            "subject": metadata.get("subject", ""),
            "attendance": latest_attendance.get("status", "Ирсэн"),
            "monthly_attendance_rate": monthly_rate,
            "training_status": "Хамрагдсан" if portal.get("trainings") else "Хамрагдаагүй",
            "training_records": portal.get("trainings", []),
            "evaluation_records": portal.get("evaluations", []),
            "rating": 0,
            "monthly_login_count": 0,
            "lms_username": metadata.get("lms_username", ""),
            "daily_records": attendance_records,
            "teaching_classes": portal.get("teaching_classes", []),
            "weekly_teaching_hours": weekly_hours,
            "overtime_hours": max(0, weekly_hours - 19),
        })
    return teachers
