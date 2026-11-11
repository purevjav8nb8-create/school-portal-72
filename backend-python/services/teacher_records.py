import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from database import supabase
from schemas.teacher_records import ActivityReview, ProgramPlanApprovalAssets, ProgramPlanReview
from services.program_plan_approval import create_approved_pdf
from services.mock_school_data import get_mock_teacher_by_id, load_mock_school_data, mock_data_enabled, update_mock_teacher_portal
from services.teacher_portal import save_teacher_portal_data, teacher_portal_data


def _get_teacher(user_id: str):
    try:
        user = supabase.auth.admin.get_user_by_id(user_id).user
    except Exception as error:
        raise HTTPException(status_code=404, detail="Багш олдсонгүй.") from error
    email = (user.email or "").lower()
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    is_teacher = (user.user_metadata or {}).get("role") == "teacher" or email.endswith("@moes.edu.mn")
    if email == admin_email or not is_teacher:
        raise HTTPException(status_code=404, detail="Багш олдсонгүй.")
    return user


def list_teacher_records() -> list[dict[str, Any]]:
    if mock_data_enabled():
        try:
            teachers = load_mock_school_data()["teachers"]
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail="Багшийн материал уншигдсангүй.") from error
        return [
            {
                "user_id": teacher["auth_id"],
                "teacher": {
                    "name": f'{teacher.get("last_name", "")} {teacher.get("first_name", "")}'.strip() or teacher.get("email", ""),
                    "email": teacher.get("email", ""),
                    "unit": teacher.get("unit", ""),
                    "subject": teacher.get("subject", ""),
                },
                "program_plan": teacher.get("program_plan"),
                "trainings": teacher.get("trainings", []),
                "activities": teacher.get("activities", []),
                "evaluations": teacher.get("evaluations", []),
                "awards": teacher.get("awards", []),
                "professional_degrees": teacher.get("professional_degrees", []),
                "teaching_classes_updated_at": teacher.get("teaching_classes_updated_at"),
            }
            for teacher in teachers
        ]

    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн материал уншигдсангүй.") from error

    records = []
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for user in users:
        metadata = user.user_metadata or {}
        app_metadata = user.app_metadata or {}
        email = (user.email or "").lower()
        is_teacher = metadata.get("role") == "teacher" or email.endswith("@moes.edu.mn")
        if email == admin_email or app_metadata.get("role") in {"admin", "manager"} or not is_teacher:
            continue
        portal = teacher_portal_data(user)
        records.append({
            "user_id": user.id,
            "teacher": {
                "name": f"{metadata.get('last_name', '')} {metadata.get('first_name', '')}".strip() or user.email,
                "email": user.email or "",
                "unit": metadata.get("unit", ""),
                "subject": metadata.get("subject", ""),
            },
            "program_plan": portal.get("program_plan"),
            "trainings": portal.get("trainings", []),
            "activities": portal.get("activities", []),
            "evaluations": portal.get("evaluations", []),
            "awards": portal.get("awards", []),
            "professional_degrees": portal.get("professional_degrees", []),
            "teaching_classes_updated_at": portal.get("teaching_classes_updated_at"),
        })
    return records


def review_program_plan(user_id: str, review: ProgramPlanReview) -> dict[str, Any]:
    user = _get_teacher(user_id)
    portal = teacher_portal_data(user)
    program_plan = portal.get("program_plan")
    if not program_plan:
        raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө ирээгүй байна.")
    if review.approved and not review.signed_document_url:
        raise HTTPException(status_code=422, detail="Гарын үсэг, тамгатай PDF шаардлагатай.")
    if review.approved:
        program_plan["documentUrl"] = review.signed_document_url
    program_plan.pop("originalDocumentUrl", None)
    program_plan.update({
        "approved": review.approved,
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
    })
    save_teacher_portal_data(user, portal)
    return program_plan


def delete_program_plan(user_id: str) -> None:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user_id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Багш олдсонгүй.")
        if not teacher.get("program_plan"):
            raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө олдсонгүй.")
        try:
            update_mock_teacher_portal(user_id, {"program_plan": None})
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        return

    user = _get_teacher(user_id)
    portal = teacher_portal_data(user)
    if not portal.get("program_plan"):
        raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө олдсонгүй.")
    portal.pop("program_plan")
    save_teacher_portal_data(user, portal)


def return_program_plan(user_id: str) -> dict[str, Any]:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user_id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Багш олдсонгүй.")
        program_plan = teacher.get("program_plan")
        if not program_plan:
            raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө олдсонгүй.")
        if program_plan.get("approved"):
            raise HTTPException(status_code=409, detail="Батлагдсан төлөвлөгөөг багшид буцаах боломжгүй.")
        updated_plan = {
            **program_plan,
            "returned": True,
            "review_status": "returned",
            "reviewedAt": datetime.now(timezone.utc).isoformat(),
        }
        try:
            update_mock_teacher_portal(user_id, {"program_plan": updated_plan})
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        saved_teacher = get_mock_teacher_by_id(user_id)
        saved_plan = (saved_teacher or {}).get("program_plan")
        if not saved_plan or saved_plan.get("review_status") != "returned":
            raise HTTPException(status_code=503, detail="Буцаасан төлөв хадгалагдсангүй.")
        return saved_plan

    user = _get_teacher(user_id)
    portal = teacher_portal_data(user)
    program_plan = portal.get("program_plan")
    if not program_plan:
        raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө олдсонгүй.")
    if program_plan.get("approved"):
        raise HTTPException(status_code=409, detail="Батлагдсан төлөвлөгөөг багшид буцаах боломжгүй.")
    program_plan["returned"] = True
    program_plan["review_status"] = "returned"
    program_plan["reviewedAt"] = datetime.now(timezone.utc).isoformat()
    save_teacher_portal_data(user, portal)
    try:
        saved_user = supabase.auth.admin.get_user_by_id(user_id).user
    except Exception as error:
        raise HTTPException(status_code=503, detail="Буцаасан төлөвийг шалгаж чадсангүй.") from error
    saved_plan = teacher_portal_data(saved_user).get("program_plan")
    if not saved_plan or saved_plan.get("review_status") != "returned":
        raise HTTPException(status_code=503, detail="Буцаасан төлөв Supabase-д хадгалагдсангүй.")
    return saved_plan


def create_program_plan_approval_pdf(user_id: str, assets: ProgramPlanApprovalAssets) -> bytes:
    user = _get_teacher(user_id)
    program_plan = teacher_portal_data(user).get("program_plan")
    if not program_plan:
        raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө ирээгүй байна.")
    return create_approved_pdf(program_plan["documentUrl"], assets.signature_url, assets.stamp_url)


def review_activity(user_id: str, activity_id: str, review: ActivityReview) -> dict[str, Any]:
    user = _get_teacher(user_id)
    portal = teacher_portal_data(user)
    activity = next((item for item in portal.get("activities", []) if item.get("id") == activity_id), None)
    if activity is None:
        raise HTTPException(status_code=404, detail="Тэмдэглэл олдсонгүй.")
    activity.update({
        "review_status": review.status,
        "admin_note": review.admin_note,
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
    })
    save_teacher_portal_data(user, portal)
    return activity
