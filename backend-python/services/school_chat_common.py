import os
from typing import Any
from fastapi import HTTPException
from database import supabase
from services.mock_school_data import load_mock_school_data, mock_data_enabled

_CHAT_TABLE = "school_chat_messages"

_READ_TABLE = "school_chat_reads"

_MAX_MESSAGES = 500

_CHAT_UNITS = {"БАЗАН", "БУЗАН", "НУЗАН"}

def _metadata(user) -> dict[str, Any]:
    return user if isinstance(user, dict) else (getattr(user, "user_metadata", None) or {})

def _user_id(user) -> str:
    return str(user.get("auth_id") if isinstance(user, dict) else user.id)

def _user_email(user) -> str:
    return str(user.get("email", "") if isinstance(user, dict) else getattr(user, "email", "") or "")

def _user_name(user) -> str:
    metadata = _metadata(user)
    return (
        f'{metadata.get("last_name", "")} {metadata.get("first_name", "")}'.strip()
        or _user_email(user)
        or "Нэргүй хэрэглэгч"
    )

def _user_role(user) -> str:
    configured_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    app_metadata = user.get("app_metadata", {}) if isinstance(user, dict) else (getattr(user, "app_metadata", None) or {})
    if (
        _metadata(user).get("role") in {"admin", "manager"}
        or app_metadata.get("role") in {"admin", "manager"}
        or _user_email(user).lower() == configured_email
    ):
        return "Сургалтын менежер" if app_metadata.get("role") == "manager" else "Админ"
    if _metadata(user).get("role") == "teacher" or _user_email(user).lower().endswith("@moes.edu.mn"):
        return "Багш"
    return "Хэрэглэгч"

def _chat_directory() -> list[Any]:
    if mock_data_enabled():
        try:
            return load_mock_school_data()["teachers"]
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail="Хэрэглэгчдийн жагсаалт уншигдсангүй.") from error
    return _list_auth_users()

def _chat_user_by_id(user_id: str):
    return next((item for item in _chat_directory() if _user_id(item) == user_id), None)

def _private_conversation_id(first_user_id: str, second_user_id: str) -> str:
    first, second = sorted((first_user_id, second_user_id))
    return f"private:{first}:{second}"

def _require_database() -> None:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Чатын өгөгдлийн сан тохируулагдаагүй байна.")

def _list_auth_users() -> list[Any]:
    _require_database()
    try:
        return supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Чатын хэрэглэгчдийн жагсаалт уншигдсангүй.") from error

def _load_rows(table: str, limit: int = 2000) -> list[dict[str, Any]]:
    _require_database()
    try:
        result = supabase.table(table).select("*").order("created_at", desc=True).limit(limit).execute()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Чатын хүснэгт олдсонгүй эсвэл унших боломжгүй байна. Supabase migration ажиллуулна уу.",
        ) from error
    return result.data or []

def _load_conversation_rows(conversation_id: str) -> list[dict[str, Any]]:
    _require_database()
    try:
        result = (
            supabase.table(_CHAT_TABLE)
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(_MAX_MESSAGES)
            .execute()
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Чатын хүснэгт олдсонгүй эсвэл унших боломжгүй байна. Supabase migration ажиллуулна уу.",
        ) from error
    return result.data or []

def _read_ids(user_id: str, message_ids: list[str]) -> set[str]:
    if not message_ids:
        return set()
    message_id_set = set(message_ids)
    read_message_ids: set[str] = set()
    try:
        for offset in range(0, 10000, 1000):
            result = (
                supabase.table(_READ_TABLE)
                .select("message_id")
                .eq("user_id", user_id)
                .range(offset, offset + 999)
                .execute()
            )
            read_message_ids.update(
                str(item["message_id"])
                for item in (result.data or [])
                if str(item.get("message_id")) in message_id_set
            )
            if len(result.data or []) < 1000:
                break
    except Exception as error:
        raise HTTPException(status_code=503, detail="Чатын уншсан төлөв уншигдсангүй.") from error
    return read_message_ids
