from fastapi import APIRouter, Header
from routers.teachers_admin import MockLoginRequest, add_manager, bulk_add_teachers, edit_teacher, get_manageable_users, get_teacher_records_for_review, mock_login, remove_teacher, set_activity_review, set_program_plan_review, set_teacher_attendance, update_user_password
from routers.teachers_admin import router as admin_router
from routers.teachers_communication import download_survey_xlsx, get_announcements, get_chat_conversations, get_chat_messages, get_chat_users, get_surveys, post_chat_message, publish_announcement, publish_survey, read_chat_messages, submit_survey_answers, submit_survey_response
from routers.teachers_communication import router as communication_router
from routers.teachers_profile import create_my_activity, create_my_award, create_my_evaluation, create_my_professional_degree, create_my_training, get_my_profile, remove_my_evaluation, submit_my_program_plan, update_my_classes
from routers.teachers_profile import router as profile_router
from schemas.teachers import TeacherCreate
from services.teacher_accounts import create_teacher_account, list_teacher_accounts
from services.teacher_auth import require_admin

__all__ = [
    "MockLoginRequest",
    "add_manager",
    "add_teacher",
    "bulk_add_teachers",
    "create_my_activity",
    "create_my_award",
    "create_my_evaluation",
    "create_my_professional_degree",
    "create_my_training",
    "download_survey_xlsx",
    "edit_teacher",
    "get_announcements",
    "get_chat_conversations",
    "get_chat_messages",
    "get_chat_users",
    "get_manageable_users",
    "get_my_profile",
    "get_surveys",
    "get_teacher_records_for_review",
    "get_teachers",
    "mock_login",
    "post_chat_message",
    "publish_announcement",
    "publish_survey",
    "read_chat_messages",
    "remove_my_evaluation",
    "remove_teacher",
    "router",
    "set_activity_review",
    "set_program_plan_review",
    "set_teacher_attendance",
    "submit_my_program_plan",
    "submit_survey_answers",
    "submit_survey_response",
    "update_my_classes",
    "update_user_password",
]

router = APIRouter(prefix="/api/teachers", tags=["Teachers"])


@router.get("")
def get_teachers(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return list_teacher_accounts()


@router.post("")
def add_teacher(
    teacher: TeacherCreate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"teacher": create_teacher_account(teacher)}


router.include_router(profile_router)
router.include_router(communication_router)
router.include_router(admin_router)
