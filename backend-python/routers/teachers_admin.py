from datetime import date

from fastapi import APIRouter, File, Header, HTTPException, Path, UploadFile
from pydantic import BaseModel
from fastapi.responses import Response
from schemas.teacher_records import ActivityReview, ProgramPlanApprovalAssets, ProgramPlanReview
from schemas.teachers import AcademicYearUpdate, AttendanceUpdate, ManagerCreate, PasswordUpdate, PublicHolidayCreate, SubstituteHoursUpdate, TeacherUpdate
from services.teacher_accounts import create_manager_account, delete_teacher_account, list_manageable_accounts, update_account_password, update_teacher_account
from services.teacher_auth import get_authenticated_user, require_admin, require_primary_admin
from services.school_public_holidays import delete_public_holiday, list_public_holidays, save_public_holiday, save_public_holidays
from services.school_schedule import calculate_monthly_overtime, create_schedule_template, delete_academic_year, get_schedule_status, import_teacher_schedule, list_academic_years, save_academic_year, save_substitute_hours
from services.teacher_import import import_teacher_file
from services.teacher_portal import update_teacher_attendance
from services.mock_school_data import get_mock_teacher_by_email, mock_data_enabled
from services.program_plan_approval import create_approval_composite, get_approval_assets, list_manager_approval_assets, save_approval_assets
from services.teacher_records import create_program_plan_approval_pdf, delete_program_plan, list_teacher_records, return_program_plan, review_activity, review_program_plan

router = APIRouter()

class MockLoginRequest(BaseModel):
    email: str
    password: str

@router.get("/academic-years")
def get_academic_years(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return list_academic_years()

@router.put("/academic-years")
def set_academic_year(
    structure: AcademicYearUpdate,
    authorization: str | None = Header(default=None),
):
    user = require_admin(authorization)
    return save_academic_year(structure, user)

@router.delete("/academic-years/{academic_year}")
def remove_academic_year(
    academic_year: str = Path(pattern=r"^\d{4}-\d{4}$"),
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    delete_academic_year(academic_year)
    return {"deleted": True}

@router.get("/academic-years/{academic_year}/schedule-template")
def get_teacher_schedule_template(
    academic_year: str = Path(pattern=r"^\d{4}-\d{4}$"),
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return Response(
        content=create_schedule_template(academic_year),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="teacher_schedule_template.xlsx"'},
    )

@router.get("/academic-years/{academic_year}/schedule")
def get_teacher_schedule_status(
    academic_year: str,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return get_schedule_status(academic_year)

@router.post("/academic-years/{academic_year}/schedule")
def upload_teacher_schedule(
    academic_year: str,
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    user = require_admin(authorization)
    return import_teacher_schedule(academic_year, file, user)

@router.get("/academic-years/{academic_year}/overtime")
def get_monthly_overtime(
    academic_year: str,
    month: date,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    return calculate_monthly_overtime(academic_year, month)

@router.put("/academic-years/{academic_year}/substitute-hours")
def set_monthly_substitute_hours(
    academic_year: str,
    month: date,
    entries: SubstituteHoursUpdate,
    authorization: str | None = Header(default=None),
):
    user = require_admin(authorization)
    return save_substitute_hours(academic_year, month, entries, user)

@router.get("/public-holidays/{year}")
def get_public_holidays(
    year: int = Path(ge=1900, le=2200),
    authorization: str | None = Header(default=None),
):
    get_authenticated_user(authorization)
    return list_public_holidays(year)

@router.post("/public-holidays/{year}")
def add_public_holiday(
    holiday: PublicHolidayCreate,
    authorization: str | None = Header(default=None),
    year: int = Path(ge=1900, le=2200),
):
    user = require_primary_admin(authorization)
    return save_public_holiday(year, holiday, user)

@router.post("/public-holidays/{year}/bulk")
def add_public_holidays(
    holidays: list[PublicHolidayCreate],
    authorization: str | None = Header(default=None),
    year: int = Path(ge=1900, le=2200),
):
    user = require_primary_admin(authorization)
    return save_public_holidays(year, holidays, user)

@router.delete("/public-holidays/{year}/{holiday_date}")
def remove_public_holiday(
    holiday_date: date,
    authorization: str | None = Header(default=None),
    year: int = Path(ge=1900, le=2200),
):
    require_primary_admin(authorization)
    delete_public_holiday(year, holiday_date)
    return {"deleted": True}

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

@router.get("/review/program-plan/approval-assets/managers")
def get_manager_program_plan_approval_assets(authorization: str | None = Header(default=None)):
    require_primary_admin(authorization)
    return list_manager_approval_assets()

@router.put("/review/program-plan/approval-assets")
def set_program_plan_approval_assets(
    assets: ProgramPlanApprovalAssets,
    authorization: str | None = Header(default=None),
):
    user = require_admin(authorization)
    if not assets.composite_url:
        raise HTTPException(status_code=422, detail="Гарын үсэг, тамганы тунгалаг нийлмэл зураг шаардлагатай.")
    return save_approval_assets(user, assets.signature_url, assets.stamp_url, assets.composite_url)

@router.post("/review/program-plan/approval-assets/composite")
def create_program_plan_approval_composite(
    assets: ProgramPlanApprovalAssets,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    content = create_approval_composite(assets.signature_url, assets.stamp_url)
    return Response(content=content, media_type="image/png")

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
    authorization: str | None = Header(default=None),
):
    approver = require_admin(authorization)
    content = create_program_plan_approval_pdf(user_id, approver)
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
    require_primary_admin(authorization)
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
