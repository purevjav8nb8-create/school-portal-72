from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from database import supabase
from schemas.teacher_records import SurveyCreate, SurveyResponseCreate, SurveySubmissionCreate
from services.school_announcements import _is_admin
from services.teacher_portal import save_teacher_portal_data, teacher_portal_data


def _save_surveys(surveys: list[dict[str, Any]]) -> None:
    try:
        admin = next(user for user in supabase.auth.admin.list_users(per_page=1000) if _is_admin(user))
        metadata = dict(admin.app_metadata or {})
        metadata["school_surveys"] = surveys
        supabase.auth.admin.update_user_by_id(admin.id, {"app_metadata": metadata})
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгааг хадгалж чадсангүй.") from error


def list_surveys(current_user) -> list[dict[str, Any]]:
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
        admin = next(user for user in users if _is_admin(user))
    except StopIteration:
        return []
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
    } for item in surveys]


def create_survey(user, survey: SurveyCreate) -> dict[str, Any]:
    item = {
        "id": str(uuid4()), "title": survey.title, "description": survey.description,
        "questions": [question.model_dump() for question in survey.questions],
        "target_units": survey.target_units,
        "createdAt": datetime.now(timezone.utc).isoformat(), "responses": [],
        "author": f'{(user.user_metadata or {}).get("last_name", "")} {(user.user_metadata or {}).get("first_name", "")}'.strip() or user.email or "",
    }
    try:
        admin = next(
            account for account in supabase.auth.admin.list_users(per_page=1000)
            if _is_admin(account)
        )
        admin_metadata = dict(admin.app_metadata or {})
        surveys = [item, *admin_metadata.get("school_surveys", [])]
        admin_metadata["school_surveys"] = surveys
        supabase.auth.admin.update_user_by_id(admin.id, {"app_metadata": admin_metadata})
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгааг хадгалж чадсангүй.") from error
    return item


def _validated_answer(survey: dict[str, Any], response: SurveyResponseCreate) -> Any:
    questions = survey.get("questions", [])
    question = questions[response.question_index] if response.question_index < len(questions) else None
    if question is None:
        raise HTTPException(status_code=404, detail="Судалгаа эсвэл асуулт олдсонгүй.")
    question_type = question.get("type", "single_choice") if isinstance(question, dict) else "single_choice"
    allowed_options = question.get("options", []) if isinstance(question, dict) else survey.get("options", [])
    answer = response.option
    if question_type in {"single_choice", "multiple_choice"}:
        answers = answer if isinstance(answer, list) else [answer]
        if (question_type == "single_choice" and len(answers) != 1) or any(item not in allowed_options for item in answers):
            raise HTTPException(status_code=422, detail="Сонгосон хариулт энэ асуултад тохирохгүй байна.")
        answer = answers if question_type == "multiple_choice" else answers[0]
    elif question_type == "short_text":
        if not isinstance(answer, str) or len(answer) > 1000:
            raise HTTPException(status_code=422, detail="Богино текст 1000 тэмдэгтээс хэтрэхгүй байна.")
    elif question_type == "rating":
        try:
            rating = int(answer) if isinstance(answer, str) else -1
        except ValueError:
            rating = -1
        if not 0 <= rating <= 10:
            raise HTTPException(status_code=422, detail="Үнэлгээ 0-10 хооронд байна.")
        answer = str(rating)
    return answer


def submit_survey(user, survey_id: str, submission: SurveySubmissionCreate) -> list[dict[str, Any]]:
    survey = next((item for item in list_surveys(user) if item["id"] == survey_id), None)
    if not survey:
        raise HTTPException(status_code=404, detail="Судалгаа олдсонгүй.")
    question_count = len(survey.get("questions", []))
    if {answer.question_index for answer in submission.answers} != set(range(question_count)):
        raise HTTPException(status_code=422, detail="Судалгааны бүх асуултад хариулна уу.")
    answers = [
        {
            "survey_id": survey_id,
            "question_index": response.question_index,
            "option": _validated_answer(survey, response),
            "submittedAt": datetime.now(timezone.utc).isoformat(),
        }
        for response in submission.answers
    ]
    portal = teacher_portal_data(user)
    responses = [
        item for item in portal.get("survey_responses", [])
        if item.get("survey_id") != survey_id
    ]
    portal["survey_responses"] = [*responses, *answers]
    save_teacher_portal_data(user, portal)
    return answers


def respond_survey(user, survey_id: str, response: SurveyResponseCreate) -> dict[str, Any]:
    survey = next((item for item in list_surveys(user) if item["id"] == survey_id), None)
    if not survey:
        raise HTTPException(status_code=404, detail="Судалгаа олдсонгүй.")
    item = {
        "survey_id": survey_id,
        "question_index": response.question_index,
        "option": _validated_answer(survey, response),
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }
    portal = teacher_portal_data(user)
    responses = [
        existing for existing in portal.get("survey_responses", [])
        if not (existing.get("survey_id") == survey_id and int(existing.get("question_index", 0)) == response.question_index)
    ]
    portal["survey_responses"] = [*responses, item]
    save_teacher_portal_data(user, portal)
    return item
