import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from fastapi import HTTPException
from database import supabase
from schemas.teacher_records import EvaluationCreate
from schemas.teachers import AttendanceUpdate, VALID_ATTENDANCE
from services.mock_school_data import mock_data_enabled, update_mock_teacher_attendance
from services.teacher_portal_common import save_teacher_attendance, save_teacher_portal_data, teacher_attendance_records, teacher_portal_data, validate_teacher_class

def add_evaluation(user, evaluation: EvaluationCreate) -> dict[str, Any]:
    validate_teacher_class(user, evaluation.grade, evaluation.section, evaluation.subject)
    item = {
        "id": str(uuid4()),
        **evaluation.model_dump(mode="json"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    portal = teacher_portal_data(user)
    portal["evaluations"] = [*portal.get("evaluations", []), item]
    save_teacher_portal_data(user, portal)
    return item

def delete_evaluation(user, evaluation_id: str) -> None:
    portal = teacher_portal_data(user)
    evaluations = portal.get("evaluations", [])
    updated = [item for item in evaluations if str(item.get("id")) != evaluation_id]
    if len(updated) == len(evaluations):
        raise HTTPException(status_code=404, detail="Үнэлгээ олдсонгүй.")
    portal["evaluations"] = updated
    save_teacher_portal_data(user, portal)

def update_teacher_attendance(user_id: str, attendance: AttendanceUpdate) -> dict[str, str]:
    if attendance.status not in VALID_ATTENDANCE:
        raise HTTPException(status_code=422, detail="Ирцийн төлөв буруу байна.")
    if mock_data_enabled():
        try:
            return update_mock_teacher_attendance(
                user_id,
                {"date": attendance.date.isoformat(), "status": attendance.status},
            )
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Туршилтын багш олдсонгүй.") from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
    try:
        target = supabase.auth.admin.get_user_by_id(user_id).user
    except Exception as error:
        raise HTTPException(status_code=404, detail="Багш олдсонгүй.") from error

    target_email = (target.email or "").lower()
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    if target_email == admin_email or (
        (target.user_metadata or {}).get("role") != "teacher"
        and not target_email.endswith("@moes.edu.mn")
    ):
        raise HTTPException(status_code=404, detail="Багш олдсонгүй.")

    records = [item for item in teacher_attendance_records(target) if item.get("date") != attendance.date.isoformat()]
    records.append({"date": attendance.date.isoformat(), "status": attendance.status})
    save_teacher_attendance(target, records)
    return {"date": attendance.date.isoformat(), "status": attendance.status}
