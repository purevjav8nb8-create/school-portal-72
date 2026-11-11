from typing import Any
from fastapi import HTTPException
from database import supabase
from services.school_announcements import _is_admin
from services.teacher_portal import teacher_portal_data
from services.school_surveys_common import _survey_is_open, _survey_owner

def list_surveys(current_user) -> list[dict[str, Any]]:
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
        admin = _survey_owner(users)
        if admin is None:
            return []
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгаа уншигдсангүй.") from error
    surveys = (admin.app_metadata or {}).get("school_surveys", [])
    unit = str((current_user.user_metadata or {}).get("unit", "")).strip().upper()
    if not _is_admin(current_user):
        surveys = [item for item in surveys if not item.get("target_units") or unit in item["target_units"]]
    own_responses = {
        f'{item.get("survey_id")}:{item.get("question_index", 0)}': item.get("option", item.get("answer"))
        for item in teacher_portal_data(current_user).get("survey_responses", [])
    }
    response_users: dict[str, dict[str, str]] = {}
    response_summary: dict[str, dict[str, dict[str, int]]] = {}
    if _is_admin(current_user):
        for user in users:
            if _is_admin(user):
                continue
            for response in teacher_portal_data(user).get("survey_responses", []):
                survey_id = str(response.get("survey_id", ""))
                if survey_id:
                    metadata = user.user_metadata or {}
                    teacher_name = f'{metadata.get("last_name", "")} {metadata.get("first_name", "")}'.strip() or user.email or "Нэргүй багш"
                    response_users.setdefault(survey_id, {})[str(user.id)] = teacher_name
                    question_index = str(response.get("question_index", 0))
                    response_summary.setdefault(survey_id, {}).setdefault(question_index, {})
                    question_counts = response_summary[survey_id][question_index]
                    answer = response.get("option", response.get("answer", ""))
                    answers = answer if isinstance(answer, list) else [answer]
                    for option in answers:
                        option = str(option)
                        question_counts[option] = question_counts.get(option, 0) + 1
    return [{
        **item,
        "responses": {str(index): option for key, option in own_responses.items() if key.startswith(f'{item["id"]}:') for index in [key.split(":", 1)[1]]},
        "response_ids": sorted(response_users.get(str(item["id"]), {})),
        "respondent_names": sorted(set(response_users.get(str(item["id"]), {}).values())),
        "response_summary": response_summary.get(str(item["id"]), {}),
        "accepts_responses": _survey_is_open(item),
    } for item in surveys]
