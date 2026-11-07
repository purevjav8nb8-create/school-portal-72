import os
from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from database import supabase
from schemas.teacher_records import ActivityCreate, AwardCreate, EvaluationCreate, ProfessionalDegreeCreate, ProgramPlanSubmit
from schemas.teachers import AttendanceUpdate, TeachingClassesUpdate, TrainingCreate, VALID_ATTENDANCE
from services.mock_school_data import get_mock_teacher_by_id, mock_data_enabled, update_mock_teacher_attendance, update_mock_teacher_classes, update_mock_teacher_portal


def teacher_portal_data(user) -> dict[str, Any]:
    return (user.user_metadata or {}).get("teacher_portal", {})


def teacher_attendance_records(user) -> list[dict[str, str]]:
    return (user.app_metadata or {}).get("teacher_attendance", [])


def validate_teacher_class(user, grade: int, section: str, subject: str) -> None:
    metadata = user.user_metadata or {}
    unit = str(metadata.get("unit") or "").strip().upper()
    if unit == "БАЗАН":
        valid_grades = range(1, 6)
    elif unit in {"БУЗАН", "НУЗАН"}:
        valid_grades = range(6, 13)
    else:
        valid_grades = range(1, 13)
    if grade not in valid_grades:
        raise HTTPException(status_code=422, detail="Сонгосон анги багшийн нэгжид тохирохгүй байна.")
    if section not in {"А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З"}:
        raise HTTPException(status_code=422, detail="Бүлгийн сонголт буруу байна.")


def save_teacher_portal_data(user, portal_data: dict[str, Any]):
    metadata = dict(user.user_metadata or {})
    metadata["teacher_portal"] = portal_data
    try:
        return supabase.auth.admin.update_user_by_id(user.id, {"user_metadata": metadata}).user
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.") from error


def save_teacher_attendance(user, records: list[dict[str, str]]):
    app_metadata = dict(user.app_metadata or {})
    app_metadata["teacher_attendance"] = records
    try:
        return supabase.auth.admin.update_user_by_id(user.id, {"app_metadata": app_metadata}).user
    except Exception as error:
        raise HTTPException(status_code=503, detail="Ирцийг Supabase-д хадгалж чадсангүй.") from error


def get_my_teacher_data(user) -> dict[str, Any]:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user.id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.")
        return {
            "profile": {
                "last_name": teacher["last_name"],
                "first_name": teacher["first_name"],
                "email": teacher["email"],
                "unit": teacher["unit"],
                "subject": teacher["subject"],
                "subjects": [teacher["subject"]],
                "role": "teacher",
                "teaching_classes": teacher.get("teaching_classes", []),
            },
            "attendance": teacher.get("attendance", []),
            "trainings": teacher.get("trainings", []),
            "evaluations": teacher.get("evaluations", []),
            "program_plan": teacher.get("program_plan"),
            "activities": teacher.get("activities", []),
            "awards": teacher.get("awards", []),
            "professional_degrees": teacher.get("professional_degrees", []),
        }


    metadata = user.user_metadata or {}
    portal = teacher_portal_data(user)
    identity_data = next(
        (identity.identity_data or {} for identity in (user.identities or []) if identity.identity_data),
        {},
    )
    full_name = (
        metadata.get("full_name")
        or metadata.get("name")
        or identity_data.get("full_name")
        or identity_data.get("name")
        or ""
    ).strip()
    name_parts = full_name.split()
    email_name = (user.email or "").split("@", 1)[0]
    last_name = metadata.get("last_name") or metadata.get("family_name") or identity_data.get("family_name")
    first_name = metadata.get("first_name") or metadata.get("given_name") or identity_data.get("given_name")
    if full_name and (not first_name or not last_name):
        if len(name_parts) > 1:
            last_name = last_name or name_parts[0]
            first_name = first_name or " ".join(name_parts[1:])
        else:
            first_name = first_name or full_name

    return {
        "profile": {
            "last_name": last_name or "",
            "first_name": first_name or email_name or "Багш",
            "email": user.email or "",
            "unit": metadata.get("unit") or "Нэгж бүртгэгдээгүй",
            "subject": metadata.get("subject") or "Мэргэжил бүртгэгдээгүй",
            "subjects": metadata.get("subjects") or ([metadata["subject"]] if metadata.get("subject") else []),
            "lms_username": metadata.get("lms_username", ""),
        },
        "attendance": teacher_attendance_records(user),
        "trainings": portal.get("trainings", []),
        "evaluations": portal.get("evaluations", []),
        "program_plan": portal.get("program_plan"),
        "activities": portal.get("activities", []),
        "awards": portal.get("awards", []),
        "professional_degrees": portal.get("professional_degrees", []),
        "teaching_classes": portal.get("teaching_classes", []),
    }


def add_my_award(user, submission: AwardCreate) -> dict[str, Any]:
    item = {**submission.model_dump(mode="json"), "id": str(uuid4()), "createdAt": datetime.now(timezone.utc).isoformat()}
    portal = teacher_portal_data(user)
    portal["awards"] = [*portal.get("awards", []), item]
    save_teacher_portal_data(user, portal)
    return item


def add_my_professional_degree(user, submission: ProfessionalDegreeCreate) -> dict[str, Any]:
    item = {**submission.model_dump(mode="json"), "id": str(uuid4()), "createdAt": datetime.now(timezone.utc).isoformat()}
    portal = teacher_portal_data(user)
    portal["professional_degrees"] = [*portal.get("professional_degrees", []), item]
    save_teacher_portal_data(user, portal)
    return item


def update_my_teaching_classes(user, submission: TeachingClassesUpdate) -> list[dict[str, Any]]:
    classes = [item.model_dump() for item in submission.classes]
    if mock_data_enabled():
        try:
            return update_mock_teacher_classes(user.id, classes)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.") from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    portal = teacher_portal_data(user)
    portal["teaching_classes"] = classes
    save_teacher_portal_data(user, portal)
    return classes


def add_my_training(user, training: TrainingCreate) -> dict[str, Any]:
    new_training = {
        "id": str(uuid4()),
        "name": training.name,
        "startDate": training.startDate.isoformat(),
        "endDate": training.endDate.isoformat(),
        "trainingType": training.trainingType,
        "certificateUrl": training.certificateUrl,
        "imageUrl": training.imageUrl,
        "createdAt": date.today().isoformat(),
    }
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user.id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.")
        trainings = [*teacher.get("trainings", []), new_training]
        try:
            update_mock_teacher_portal(user.id, {"trainings": trainings})
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        return new_training
    portal = teacher_portal_data(user)
    portal["trainings"] = [*portal.get("trainings", []), new_training]
    save_teacher_portal_data(user, portal)
    return new_training


def submit_program_plan(user, submission: ProgramPlanSubmit) -> dict[str, Any]:
    validate_teacher_class(user, submission.grade, submission.section, submission.subject)
    program_plan = {
        "documentUrl": submission.documentUrl,
        "grade": submission.grade,
        "section": submission.section,
        "subject": submission.subject,
        "grade": submission.grade,
        "section": submission.section,
        "subject": submission.subject,
        "note": submission.note,
        "approved": False,
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }
    portal = teacher_portal_data(user)
    portal["program_plan"] = program_plan
    save_teacher_portal_data(user, portal)
    return program_plan


def add_my_activity(user, submission: ActivityCreate) -> dict[str, Any]:
    if submission.category == "Хичээлд суусан":
        validate_teacher_class(user, submission.grade, submission.section, submission.subject)
    activity = {
        "id": str(uuid4()),
        "category": submission.category,
        "title": submission.title,
        "date": submission.date.isoformat(),
        "note": submission.note,
        "images": submission.images,
        "attachments": [attachment.model_dump() for attachment in submission.attachments],
        "grade": submission.grade,
        "section": submission.section,
        "subject": submission.subject,
        "review_status": "pending",
        "admin_note": "",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }
    portal = teacher_portal_data(user)
    portal["activities"] = [*portal.get("activities", []), activity]
    save_teacher_portal_data(user, portal)
    return activity


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
