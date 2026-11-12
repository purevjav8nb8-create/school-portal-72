from fastapi import APIRouter, Header
from fastapi.responses import Response
from schemas.school_chat import ChatMessageCreate, ChatReadRequest
from schemas.teacher_records import AnnouncementCreate, SurveyCreate, SurveyResponseCreate, SurveySubmissionCreate
from services.school_announcements import create_announcement, list_announcements
from services.school_chat import create_chat_message, list_chat_conversations, list_chat_messages, list_chat_users, mark_chat_read
from services.school_surveys import create_survey, delete_survey, export_survey_xlsx, list_surveys, respond_survey, submit_survey
from services.teacher_auth import get_authenticated_user

router = APIRouter()

@router.get("/announcements")
def get_announcements(kind: str | None = None, authorization: str | None = Header(default=None)):
    return list_announcements(get_authenticated_user(authorization), kind)

@router.get("/chat/conversations")
def get_chat_conversations(authorization: str | None = Header(default=None)):
    return list_chat_conversations(get_authenticated_user(authorization))

@router.get("/chat/users")
def get_chat_users(
    q: str = "",
    authorization: str | None = Header(default=None),
):
    return list_chat_users(get_authenticated_user(authorization), q)

@router.get("/chat/messages")
def get_chat_messages(
    conversation_id: str,
    authorization: str | None = Header(default=None),
):
    return list_chat_messages(get_authenticated_user(authorization), conversation_id)

@router.post("/chat/messages")
def post_chat_message(
    message: ChatMessageCreate,
    authorization: str | None = Header(default=None),
):
    return {"message": create_chat_message(get_authenticated_user(authorization), message)}

@router.post("/chat/read")
def read_chat_messages(
    request: ChatReadRequest,
    authorization: str | None = Header(default=None),
):
    return mark_chat_read(get_authenticated_user(authorization), request.conversation_id)

@router.post("/announcements")
def publish_announcement(
    announcement: AnnouncementCreate,
    authorization: str | None = Header(default=None),
):
    user = get_authenticated_user(authorization)
    return {"announcement": create_announcement(user, announcement)}

@router.get("/surveys")
def get_surveys(authorization: str | None = Header(default=None)):
    return list_surveys(get_authenticated_user(authorization))

@router.get("/surveys/{survey_id}/export")
def download_survey_xlsx(survey_id: str, authorization: str | None = Header(default=None)):
    content, filename = export_survey_xlsx(get_authenticated_user(authorization), survey_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )

@router.post("/surveys")
def publish_survey(survey: SurveyCreate, authorization: str | None = Header(default=None)):
    return {"survey": create_survey(get_authenticated_user(authorization), survey)}

@router.delete("/surveys/{survey_id}")
def remove_survey(survey_id: str, authorization: str | None = Header(default=None)):
    delete_survey(get_authenticated_user(authorization), survey_id)
    return {"deleted": True}

@router.post("/surveys/{survey_id}/responses")
def submit_survey_response(survey_id: str, response: SurveyResponseCreate, authorization: str | None = Header(default=None)):
    return {"response": respond_survey(get_authenticated_user(authorization), survey_id, response)}

@router.post("/surveys/{survey_id}/submit")
def submit_survey_answers(survey_id: str, submission: SurveySubmissionCreate, authorization: str | None = Header(default=None)):
    return {"responses": submit_survey(get_authenticated_user(authorization), survey_id, submission)}
