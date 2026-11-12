from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from fastapi import HTTPException
from database import supabase
from schemas.teacher_records import SurveyCreate, SurveyResponseCreate, SurveySubmissionCreate
from services.school_announcements import _is_admin
from services.teacher_portal import save_teacher_portal_data, teacher_portal_data
from services.school_surveys_common import _survey_is_open, _survey_owner
from services.school_survey_listing import list_surveys

def create_survey(user, survey: SurveyCreate) -> dict[str, Any]:
    item = {
        "id": str(uuid4()), "title": survey.title, "description": survey.description,
        "questions": [question.model_dump() for question in survey.questions],
        "target_units": survey.target_units,
        "starts_at": survey.starts_at.isoformat(), "ends_at": survey.ends_at.isoformat(),
        "createdAt": datetime.now(timezone.utc).isoformat(), "responses": [],
        "created_by": str(user.id),
        "author": f'{(user.user_metadata or {}).get("last_name", "")} {(user.user_metadata or {}).get("first_name", "")}'.strip() or user.email or "",
    }
    try:
        admin = _survey_owner(supabase.auth.admin.list_users(per_page=1000))
        if admin is None:
            raise HTTPException(status_code=404, detail="Судалгааны эзэмшигч олдсонгүй.")
        admin_metadata = dict(admin.app_metadata or {})
        surveys = [item, *admin_metadata.get("school_surveys", [])]
        admin_metadata["school_surveys"] = surveys
        supabase.auth.admin.update_user_by_id(admin.id, {"app_metadata": admin_metadata})
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгааг хадгалж чадсангүй.") from error
    return item

def delete_survey(user, survey_id: str) -> None:
    try:
        admin = _survey_owner(supabase.auth.admin.list_users(per_page=1000))
        if admin is None:
            raise HTTPException(status_code=503, detail="Судалгааны эзэмшигч олдсонгүй.")
        admin_metadata = dict(admin.app_metadata or {})
        surveys = admin_metadata.get("school_surveys", [])
        survey = next((item for item in surveys if str(item.get("id")) == survey_id), None)
        if survey is None:
            raise HTTPException(status_code=404, detail="Судалгаа олдсонгүй.")
        if str(survey.get("created_by", "")) != str(user.id) and not _is_admin(user):
            raise HTTPException(status_code=403, detail="Судалгааг зөвхөн оруулсан хүн эсвэл админ устгах боломжтой.")
        admin_metadata["school_surveys"] = [item for item in surveys if str(item.get("id")) != survey_id]
        supabase.auth.admin.update_user_by_id(admin.id, {"app_metadata": admin_metadata})
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Судалгааг устгаж чадсангүй.") from error

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
    if not _survey_is_open(survey):
        raise HTTPException(status_code=409, detail="Судалгааны хугацаа эхлээгүй эсвэл дууссан байна.")
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
    if not _survey_is_open(survey):
        raise HTTPException(status_code=409, detail="Судалгааны хугацаа эхлээгүй эсвэл дууссан байна.")
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
