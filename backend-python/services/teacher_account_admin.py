from typing import Any
from fastapi import HTTPException
from database import supabase
from schemas.teachers import ManagerCreate, PasswordUpdate
from services.mock_school_data import load_mock_school_data, mock_data_enabled

def create_manager_account(manager: ManagerCreate) -> dict[str, Any]:
    email = manager.email.strip().lower()
    if not email.endswith("@moes.edu.mn") or email.count("@") != 1:
        raise HTTPException(status_code=422, detail="Менежерийн @moes.edu.mn и-мэйл хаяг шаардлагатай.")
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    metadata = {
        "first_name": manager.first_name.strip(),
        "last_name": manager.last_name.strip(),
        "role": "manager",
    }
    try:
        created_user = supabase.auth.admin.create_user({
            "email": email,
            "password": manager.password,
            "email_confirm": True,
            "user_metadata": metadata,
            "app_metadata": {"role": "manager"},
        }).user
    except Exception as error:
        if getattr(error, "status", None) in {401, 403}:
            raise HTTPException(status_code=503, detail="Supabase service-role key эрхгүй байна.") from error
        if getattr(error, "code", None) == "email_exists":
            raise HTTPException(status_code=409, detail=f"{email} хаягтай хэрэглэгч аль хэдийн байна.") from error
        raise HTTPException(status_code=409, detail=f"{email} менежерийн хэрэглэгч үүссэнгүй.") from error
    return {**metadata, "auth_id": created_user.id, "email": email}

def update_account_password(user_id: str, password: PasswordUpdate) -> None:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        supabase.auth.admin.update_user_by_id(user_id, {"password": password.password})
    except Exception as error:
        raise HTTPException(status_code=503, detail="Нууц үгийг шинэчилж чадсангүй.") from error

def list_manageable_accounts(current_user_id: str) -> list[dict[str, str]]:
    if mock_data_enabled():
        return [
            {
                "id": str(teacher["auth_id"]),
                "email": str(teacher.get("email", "")),
                "first_name": str(teacher.get("first_name", "")),
                "last_name": str(teacher.get("last_name", "")),
                "role": "teacher",
            }
            for teacher in load_mock_school_data()["teachers"]
            if str(teacher.get("auth_id")) != current_user_id
        ]
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Хэрэглэгчдийн жагсаалт уншигдсангүй.") from error
    return [
        {
            "id": str(user.id),
            "email": user.email or "",
            "first_name": (user.user_metadata or {}).get("first_name", ""),
            "last_name": (user.user_metadata or {}).get("last_name", ""),
            "role": (user.app_metadata or {}).get("role", "teacher"),
        }
        for user in users
    ]
