from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4
from fastapi import HTTPException
from schemas.teacher_records import ActivityCreate, AwardCreate, ProfessionalDegreeCreate, ProgramPlanSubmit
from schemas.teachers import TeachingClassesUpdate, TrainingCreate
from services.mock_school_data import get_mock_teacher_by_id, mock_data_enabled, update_mock_teacher_classes, update_mock_teacher_portal
from services.teacher_portal_common import save_teacher_portal_data, teacher_portal_data, validate_teacher_class

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
    portal["teaching_classes_updated_at"] = datetime.now(timezone.utc).isoformat()
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
        "id": str(uuid4()),
        "documentUrl": submission.documentUrl,
        "grade": submission.grade,
        "section": submission.section,
        "subject": submission.subject,
        "grade": submission.grade,
        "section": submission.section,
        "subject": submission.subject,
        "note": submission.note,
        "approved": False,
        "returned": False,
        "review_status": "pending",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }
    portal = teacher_portal_data(user)
    portal["program_plan"] = program_plan
    save_teacher_portal_data(user, portal)
    return program_plan

def delete_my_program_plan(user) -> None:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user.id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.")
        if not teacher.get("program_plan"):
            raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө олдсонгүй.")
        try:
            update_mock_teacher_portal(user.id, {"program_plan": None})
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        return

    portal = teacher_portal_data(user)
    if not portal.get("program_plan"):
        raise HTTPException(status_code=404, detail="Хөтөлбөр, төлөвлөгөө олдсонгүй.")
    portal.pop("program_plan")
    save_teacher_portal_data(user, portal)

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
