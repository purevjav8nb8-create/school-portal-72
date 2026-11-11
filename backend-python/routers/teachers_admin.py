from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from pydantic import BaseModel
from fastapi.responses import Response
from schemas.teacher_records import ActivityReview, ProgramPlanApprovalAssets, ProgramPlanReview
from schemas.teachers import AttendanceUpdate, ManagerCreate, PasswordUpdate, TeacherUpdate
from services.teacher_accounts import create_manager_account, delete_teacher_account, list_manageable_accounts, update_account_password, update_teacher_account
from services.teacher_auth import require_admin
from services.teacher_import import import_teacher_file
from services.teacher_portal import update_teacher_attendance
from services.mock_school_data import get_mock_teacher_by_email, mock_data_enabled
from services.program_plan_approval import get_approval_assets, save_approval_assets
from services.teacher_records import create_program_plan_approval_pdf, delete_program_plan, list_teacher_records, return_program_plan, review_activity, review_program_plan

router = APIRouter()

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

@router.get("/review")
def get_teacher_records_for_review(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return list_teacher_records()

@router.get("/review/program-plan/approval-assets")
def get_program_plan_approval_assets(authorization: str | None = Header(default=None)):
    user = require_admin(authorization)
    return get_approval_assets(user)

@router.put("/review/program-plan/approval-assets")
def set_program_plan_approval_assets(
    assets: ProgramPlanApprovalAssets,
    authorization: str | None = Header(default=None),
):
    user = require_admin(authorization)
    return save_approval_assets(user, assets.signature_url, assets.stamp_url)

@router.patch("/review/{user_id}/program-plan")
def set_program_plan_review(
    user_id: str,
    review: ProgramPlanReview,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"program_plan": review_program_plan(user_id, review)}

@router.delete("/review/{user_id}/program-plan")
def remove_program_plan(
    user_id: str,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    delete_program_plan(user_id)
    return {"deleted": True}

@router.post("/review/{user_id}/program-plan/return")
def return_teacher_program_plan(
    user_id: str,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"program_plan": return_program_plan(user_id)}

@router.post("/review/{user_id}/program-plan/approved-pdf")
def get_program_plan_approval_pdf(
    user_id: str,
    assets: ProgramPlanApprovalAssets,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    content = create_program_plan_approval_pdf(user_id, assets)
    return Response(content=content, media_type="application/pdf")

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

@router.post("/managers")
def add_manager(
    manager: ManagerCreate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return {"manager": create_manager_account(manager)}

@router.get("/users")
def get_manageable_users(authorization: str | None = Header(default=None)):
    user = require_admin(authorization)
    return list_manageable_accounts(str(user.id))

@router.put("/users/{user_id}/password")
def update_user_password(
    user_id: str,
    password: PasswordUpdate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    update_account_password(user_id, password)
    return {"updated": True}

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
