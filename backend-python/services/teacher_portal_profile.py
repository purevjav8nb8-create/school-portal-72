from datetime import date
from typing import Any
from fastapi import HTTPException
from services.mock_school_data import get_mock_teacher_by_id, load_mock_school_data, mock_data_enabled
from services.teacher_portal_common import teacher_attendance_records, teacher_portal_data
from services.teacher_portal_storage import list_portal_records
from services.school_schedule import calculate_my_monthly_overtime, get_teacher_schedule_assignments

def homeroom_evaluations(user) -> list[dict[str, Any]]:
    metadata = user.user_metadata or {}
    own_portal = teacher_portal_data(user)
    if mock_data_enabled():
        own_teacher = get_mock_teacher_by_id(user.id)
        own_portal = own_teacher or {}
    homeroom_classes = {
        (item.get("grade"), item.get("section"))
        for item in own_portal.get("teaching_classes", [])
        if item.get("homeroom")
    }
    if not homeroom_classes:
        return []

    sources: list[tuple[str, dict[str, Any], dict[str, Any], str]] = []
    if mock_data_enabled():
        sources = [
            (teacher.get("auth_id", ""), teacher, teacher, teacher.get("email", ""))
            for teacher in load_mock_school_data()["teachers"]
        ]
    else:
        sources = [
            (
                str(record.get("teacher_id", "")),
                {"last_name": "", "first_name": "", "teacher_name": record.get("teacher_name", "")},
                record,
                record.get("teacher_email", ""),
            )
            for record in list_portal_records("evaluations")
        ]

    received = []
    for source_id, source_metadata, source_data, source_email in sources:
        portal = source_data if mock_data_enabled() else {"evaluations": [source_data.get("payload", {})]}
        for evaluation in portal.get("evaluations", []):
            class_key = (evaluation.get("grade"), evaluation.get("section"))
            if class_key in homeroom_classes:
                received.append({
                    **evaluation,
                    "id": f"{source_id}:{evaluation.get('id', '')}",
                    "evaluator_id": source_id,
                    "evaluator": source_metadata.get("teacher_name") or f'{source_metadata.get("last_name", "")} {source_metadata.get("first_name", "")}'.strip(),
                    "evaluator_email": source_email,
                })
    return sorted(received, key=lambda item: (item.get("evaluation_date", ""), item.get("createdAt", "")), reverse=True)

def get_my_program_plan(user) -> dict[str, Any] | None:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user.id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.")
        return teacher.get("program_plan")
    return teacher_portal_data(user).get("program_plan")


def _my_schedule_metrics(user) -> dict[str, Any]:
    try:
        report = calculate_my_monthly_overtime(user, date.today().replace(day=1))
        own = (report.get("teachers") or [None])[0]
        if not own:
            return {}
        return {
            "weekly_teaching_hours": (
                own.get("weekly_base_hours", 0)
                + own.get("weekly_even_hours", 0)
                + own.get("weekly_odd_hours", 0)
            ),
            "scheduled_hours": own.get("scheduled_hours", 0),
            "substitute_hours": own.get("substitute_hours", 0),
            "actual_hours": own.get("actual_hours", 0),
            "norm_hours": own.get("norm_hours", 0),
            "overtime_hours": own.get("overtime_hours", 0),
        }
    except HTTPException:
        return {}
    except Exception:
        return {}

def get_my_teacher_data(user) -> dict[str, Any]:
    schedule_metrics = _my_schedule_metrics(user)
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(user.id)
        if teacher is None:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.")
        return {
            "profile": {
                "user_id": str(user.id),
                "user_id": str(user.id),
                "last_name": teacher["last_name"],
                "first_name": teacher["first_name"],
                "email": teacher["email"],
                "unit": teacher["unit"],
                "subject": teacher["subject"],
                "subjects": [teacher["subject"]],
                "role": "teacher",
                "teaching_classes": teacher.get("teaching_classes", []),
                **schedule_metrics,
            },
            "teaching_schedule": get_teacher_schedule_assignments(str(user.id)),
            "attendance": teacher.get("attendance", []),
            "trainings": teacher.get("trainings", []),
            "evaluations": teacher.get("evaluations", []),
            "program_plan": teacher.get("program_plan"),
            "activities": teacher.get("activities", []),
            "awards": teacher.get("awards", []),
            "professional_degrees": teacher.get("professional_degrees", []),
            "homeroom_evaluations": homeroom_evaluations(user),
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
            **schedule_metrics,
        },
        "attendance": teacher_attendance_records(user),
        "trainings": portal.get("trainings", []),
        "evaluations": portal.get("evaluations", []),
        "program_plan": portal.get("program_plan"),
        "activities": portal.get("activities", []),
        "awards": portal.get("awards", []),
        "professional_degrees": portal.get("professional_degrees", []),
        "teaching_classes": portal.get("teaching_classes", []),
        "teaching_schedule": get_teacher_schedule_assignments(str(user.id)),
        "homeroom_evaluations": homeroom_evaluations(user),
    }
