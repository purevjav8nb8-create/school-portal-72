import os
from types import SimpleNamespace

from fastapi import HTTPException

from database import supabase
from services.mock_school_data import get_mock_teacher_by_email, get_mock_teacher_by_id, mock_data_enabled


def get_authenticated_user(authorization: str | None):
    if mock_data_enabled() and authorization and authorization.lower().startswith("bearer mock:"):
        auth_id = authorization.split(":", 1)[1]
        teacher = get_mock_teacher_by_id(auth_id)
        if teacher is None:
            raise HTTPException(status_code=401, detail="Mock нэвтрэх эрх хүчингүй байна.")
        return SimpleNamespace(
            id=teacher["auth_id"],
            email=teacher["email"],
            user_metadata={
                "first_name": teacher["first_name"],
                "last_name": teacher["last_name"],
                "unit": teacher["unit"],
                "subject": teacher["subject"],
                "role": "teacher",
            },
            app_metadata={"role": "teacher", "teacher_attendance": teacher.get("attendance", [])},
            identities=[],
        )
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Нэвтрэх эрх шаардлагатай.")
    try:
        response = supabase.auth.get_user(authorization.split(" ", 1)[1])
        user = response.user if response else None
    except Exception as error:
        raise HTTPException(status_code=401, detail="Нэвтрэх эрх хүчингүй байна.") from error
    if not user:
        raise HTTPException(status_code=401, detail="Нэвтрэх эрх хүчингүй байна.")
    return user


def require_admin(authorization: str | None):
    user = get_authenticated_user(authorization)
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    if (user.app_metadata or {}).get("role") not in {"admin", "manager"} and (user.email or "").lower() != admin_email:
        raise HTTPException(status_code=403, detail="Админы эрх шаардлагатай.")
    return user


def require_teacher(authorization: str | None):
    user = get_authenticated_user(authorization)
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    email = (user.email or "").lower()
    if (user.app_metadata or {}).get("role") in {"admin", "manager"} or email == admin_email:
        raise HTTPException(status_code=403, detail="Энэ үйлдлийг хийх эрхгүй байна.")
    if (user.app_metadata or {}).get("role") != "teacher" and not email.endswith("@moes.edu.mn"):
        raise HTTPException(status_code=403, detail="Энэ үйлдлийг хийх эрхгүй байна.")
    return user
