from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from schemas.teacher_records import ActivityCreate, ActivityReview, AnnouncementCreate, AwardCreate, EvaluationCreate, ProfessionalDegreeCreate, ProgramPlanReview, ProgramPlanSubmit, SurveyCreate, SurveyResponseCreate, SurveySubmissionCreate
from schemas.teachers import AttendanceUpdate, TeacherCreate, TeacherUpdate, TeachingClassesUpdate, TrainingCreate
from services.school_announcements import create_announcement, list_announcements
from services.school_surveys import create_survey, list_surveys, respond_survey, submit_survey
from services.teacher_accounts import create_teacher_account, delete_teacher_account, list_teacher_accounts, update_teacher_account
from services.teacher_auth import get_authenticated_user, require_admin, require_teacher
from services.teacher_import import import_teacher_file
from services.teacher_portal import add_evaluation, add_my_activity, add_my_award, add_my_professional_degree, add_my_training, delete_evaluation, get_my_teacher_data, submit_program_plan, update_my_teaching_classes, update_teacher_attendance
from services.mock_school_data import get_mock_teacher_by_email, mock_data_enabled
from services.teacher_records import list_teacher_records, review_activity, review_program_plan

router = APIRouter(prefix="/api/teachers", tags=["Teachers"])


class MockLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/mock-login")
def mock_login(credentials: MockLoginRequest):
    if not mock_data_enabled():
        raise HTTPException(status_code=404, detail="Mock нэвтрэлт идэвхгүй байна.")
    teacher = get_mock_teacher_by_email(credentials.email)
    if teacher is None or credentials.password != "12345678":
        raise HTTPException(status_code=401, detail="Загвар багшийн нэвтрэх нэр эсвэл нууц үг буруу байна.")
    return {
        "access_token": f"mock:{teacher['auth_id']}",
        "token_type": "bearer",
        "profile": {
            "last_name": teacher["last_name"],
            "first_name": teacher["first_name"],
            "email": teacher["email"],
            "unit": teacher["unit"],
            "subject": teacher["subject"],
            "role": "teacher",
            "teaching_classes": teacher.get("teaching_classes", []),
        },
    }


@router.get("")
def get_teachers(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return list_teacher_accounts()


@router.get("/me")
def get_my_profile(authorization: str | None = Header(default=None)):
    user = require_teacher(authorization)
    return get_my_teacher_data(user)


@router.put("/me/teaching-classes")
def update_my_classes(
    classes: TeachingClassesUpdate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"teaching_classes": update_my_teaching_classes(user, classes)}


@router.post("/me/trainings")
def create_my_training(
    training: TrainingCreate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"training": add_my_training(user, training)}


@router.post("/me/activities")
def create_my_activity(
    activity: ActivityCreate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"activity": add_my_activity(user, activity)}


@router.post("/me/evaluations")
def create_my_evaluation(
    evaluation: EvaluationCreate,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"evaluation": add_evaluation(user, evaluation)}


@router.delete("/me/evaluations/{evaluation_id}")
def remove_my_evaluation(
    evaluation_id: str,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    delete_evaluation(user, evaluation_id)
    return {"deleted": True}


@router.put("/me/program-plan")
def submit_my_program_plan(
    submission: ProgramPlanSubmit,
    authorization: str | None = Header(default=None),
):
    user = require_teacher(authorization)
    return {"program_plan": submit_program_plan(user, submission)}


@router.get("/announcements")
def get_announcements(kind: str | None = None, authorization: str | None = Header(default=None)):
    return list_announcements(get_authenticated_user(authorization), kind)


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


@router.post("/surveys")
def publish_survey(survey: SurveyCreate, authorization: str | None = Header(default=None)):
    return {"survey": create_survey(get_authenticated_user(authorization), survey)}


@router.post("/surveys/{survey_id}/responses")
def submit_survey_response(survey_id: str, response: SurveyResponseCreate, authorization: str | None = Header(default=None)):
    return {"response": respond_survey(require_teacher(authorization), survey_id, response)}


@router.post("/surveys/{survey_id}/submit")
def submit_survey_answers(survey_id: str, submission: SurveySubmissionCreate, authorization: str | None = Header(default=None)):
    return {"responses": submit_survey(require_teacher(authorization), survey_id, submission)}


@router.get("/review")
def get_teacher_records_for_review(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return list_teacher_records()


@router.post("/me/awards")
def create_my_award(award: AwardCreate, authorization: str | None = Header(default=None)):
    return {"award": add_my_award(require_teacher(authorization), award)}


@router.post("/me/professional-degrees")
def create_my_professional_degree(degree: ProfessionalDegreeCreate, authorization: str | None = Header(default=None)):
    return {"degree": add_my_professional_degree(require_teacher(authorization), degree)}


@router.patch("/review/{user_id}/program-plan")
def set_program_plan_review(
    user_id: str,
    review: ProgramPlanReview,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"program_plan": review_program_plan(user_id, review)}


@router.patch("/review/{user_id}/activities/{activity_id}")
def set_activity_review(
    user_id: str,
    activity_id: str,
    review: ActivityReview,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"activity": review_activity(user_id, activity_id, review)}


@router.put("/{user_id}/attendance")
def set_teacher_attendance(
    user_id: str,
    attendance: AttendanceUpdate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return update_teacher_attendance(user_id, attendance)


@router.post("")
def add_teacher(
    teacher: TeacherCreate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"teacher": create_teacher_account(teacher)}


@router.patch("/{user_id}")
def edit_teacher(
    user_id: str,
    teacher: TeacherUpdate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"teacher": update_teacher_account(user_id, teacher)}


@router.delete("/{user_id}")
def remove_teacher(
    user_id: str,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    delete_teacher_account(user_id)
    return {"deleted": True}


@router.post("/bulk-upload")
def bulk_add_teachers(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return import_teacher_file(file)
