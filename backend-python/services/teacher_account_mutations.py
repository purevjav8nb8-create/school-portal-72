import secrets
from typing import Any
from fastapi import HTTPException
from supabase_auth.types import AdminUserAttributes
from database import supabase
from services.attendance_automation import school_today
from schemas.teachers import TeacherCreate, TeacherUpdate, VALID_UNITS

def create_teacher_account(teacher: TeacherCreate) -> dict[str, Any]:
    email = teacher.email.strip().lower()
    local_part, separator, domain = email.partition("@")
    if not local_part or not separator or email.count("@") != 1 or domain != "moes.edu.mn":
        raise HTTPException(status_code=422, detail="Багшийн @moes.edu.mn и-мэйл хаяг шаардлагатай.")
    if teacher.unit not in VALID_UNITS:
        raise HTTPException(status_code=422, detail=f"Нэгж буруу байна: {teacher.unit}")
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")

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
        "app_metadata": {
            "role": "teacher",
            "teacher_attendance": [{"date": school_today().isoformat(), "status": "Ирсэн"}],
        },
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
        current_metadata = supabase.auth.admin.get_user_by_id(user_id).user.user_metadata or {}
        updated_metadata = {
            **current_metadata,
            "first_name": teacher.first_name.strip(),
            "last_name": teacher.last_name.strip(),
            "unit": teacher.unit,
            "subject": teacher.subject.strip(),
            "role": "teacher",
        }
        user = supabase.auth.admin.update_user_by_id(user_id, {
            "user_metadata": updated_metadata,
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
        if (user.app_metadata or {}).get("role") in {"admin", "manager"}:
            raise HTTPException(status_code=403, detail="Админ болон менежер хэрэглэгчийг энэ хэсгээс устгах боломжгүй.")
        supabase.auth.admin.delete_user(user_id)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийг устгаж чадсангүй.") from error
