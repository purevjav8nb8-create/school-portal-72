import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from database import supabase
from schemas.teacher_records import ActivityReview, ProgramPlanReview
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
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн материал уншигдсангүй.") from error

    records = []
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for user in users:
        metadata = user.user_metadata or {}
        email = (user.email or "").lower()
        is_teacher = metadata.get("role") == "teacher" or email.endswith("@moes.edu.mn")
        if email == admin_email or not is_teacher:
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
            "activities": portal.get("activities", []),
            "evaluations": portal.get("evaluations", []),
        })
    return records


def review_program_plan(user_id: str, review: ProgramPlanReview) -> dict[str, Any]:
    user = _get_teacher(user_id)
    portal = teacher_portal_data(user)
    program_plan = portal.get("program_plan")
    if not program_plan:
        raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө ирээгүй байна.")
    program_plan.update({
        "approved": review.approved,
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
    })
    save_teacher_portal_data(user, portal)
    return program_plan


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
