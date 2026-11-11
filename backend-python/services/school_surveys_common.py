from datetime import datetime, timezone
import os
from typing import Any
from fastapi import HTTPException
from database import supabase

def _survey_owner(users: list[Any]) -> Any | None:
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    return (
        next((user for user in users if (user.email or "").lower() == admin_email), None)
        or next((user for user in users if (user.app_metadata or {}).get("role") == "admin"), None)
        or next((user for user in users if (user.app_metadata or {}).get("role") == "manager"), None)
    )

def _survey_is_open(survey: dict[str, Any]) -> bool:
    now = datetime.now(timezone.utc)
    starts_at = survey.get("starts_at")
    ends_at = survey.get("ends_at")
    if starts_at:
        start = datetime.fromisoformat(str(starts_at).replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if now < start:
            return False
    if ends_at:
        end = datetime.fromisoformat(str(ends_at).replace("Z", "+00:00"))
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if now > end:
            return False
    return True

def _save_surveys(surveys: list[dict[str, Any]]) -> None:
    try:
        admin = _survey_owner(supabase.auth.admin.list_users(per_page=1000))
        if admin is None:
            raise HTTPException(status_code=503, detail="Судалгааны эзэмшигч олдсонгүй.")
        metadata = dict(admin.app_metadata or {})
        metadata["school_surveys"] = surveys
        supabase.auth.admin.update_user_by_id(admin.id, {"app_metadata": metadata})
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгааг хадгалж чадсангүй.") from error
