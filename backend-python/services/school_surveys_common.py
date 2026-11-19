from datetime import datetime, timezone
import os
from typing import Any
from fastapi import HTTPException
from services.teacher_portal_storage import (
    delete_school_survey,
    list_school_surveys,
    save_school_survey,
)

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
    existing = {str(row.get("id")): row for row in list_school_surveys()}
    for survey in surveys:
        row = existing.get(str(survey.get("id")))
        owner_id = row.get("owner_id") if row else survey.get("created_by")
        if not owner_id:
            raise HTTPException(status_code=503, detail="Судалгааны эзэмшигч олдсонгүй.")
        owner = type("SurveyOwner", (), {"id": owner_id})()
        save_school_survey(owner, survey)
    retained = {str(survey.get("id")) for survey in surveys}
    for survey_id in set(existing) - retained:
        delete_school_survey(survey_id)
