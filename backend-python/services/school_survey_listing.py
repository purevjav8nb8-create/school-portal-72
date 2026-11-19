from typing import Any
from fastapi import HTTPException
from services.school_announcements import _is_admin
from services.school_surveys_common import _survey_is_open
from services.teacher_portal_storage import list_school_surveys, list_survey_responses

def list_surveys(current_user) -> list[dict[str, Any]]:
    try:
        surveys = [row.get("payload") or {} for row in list_school_surveys()]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгаа уншигдсангүй.") from error
    surveys.sort(key=lambda item: item.get("createdAt", ""), reverse=True)
    manageable_survey_ids = {
        str(item.get("id"))
        for item in surveys
        if (
            str(item.get("created_by", "")) == str(current_user.id)
            or ("created_by" not in item and _is_admin(current_user))
        )
    }
    unit = str((current_user.user_metadata or {}).get("unit", "")).strip().upper()
    if not _is_admin(current_user):
        surveys = [
            item for item in surveys
            if str(item.get("created_by", "")) == str(current_user.id)
            or not item.get("target_units")
            or unit in item["target_units"]
        ]
    all_responses = list_survey_responses()
    own_responses = {}
    response_users: dict[str, dict[str, str]] = {}
    response_summary: dict[str, dict[str, dict[str, int]]] = {}
    own_id = str(current_user.id)
    manageable = {str(item.get("id")) for item in surveys if str(item.get("id")) in manageable_survey_ids}
    for row in all_responses:
        response = row.get("payload") or {}
        survey_id = str(response.get("survey_id", ""))
        user_id = str(row.get("teacher_id", ""))
        question_index = str(response.get("question_index", 0))
        answer = response.get("option", response.get("answer"))
        if user_id == own_id:
            own_responses[f"{survey_id}:{question_index}"] = answer
        if survey_id not in manageable:
            continue
        response_users.setdefault(survey_id, {})[user_id] = (
            row.get("respondent_name") or "Нэргүй багш"
        )
        response_summary.setdefault(survey_id, {}).setdefault(question_index, {})
        question_counts = response_summary[survey_id][question_index]
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
        "can_view_results": str(item.get("id")) in manageable_survey_ids,
        "can_delete": (
            str(item.get("created_by", "")) == str(current_user.id)
            or _is_admin(current_user)
        ),
    } for item in surveys]
