from typing import Any
from fastapi import HTTPException
from database import supabase
from services.mock_school_data import get_mock_teacher_by_id, load_mock_school_data, mock_data_enabled
from services.teacher_portal_common import teacher_attendance_records, teacher_portal_data

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

    sources: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    if mock_data_enabled():
        sources = [
            (teacher.get("auth_id", ""), teacher, teacher)
            for teacher in load_mock_school_data()["teachers"]
        ]
    else:
        try:
            sources = [
                (account.id, account.user_metadata or {}, account.user_metadata or {})
                for account in supabase.auth.admin.list_users(per_page=1000)
            ]
        except Exception as error:
            raise HTTPException(status_code=503, detail="Анги удирдсан багшийн үнэлгээ уншигдсангүй.") from error

    received = []
    for source_id, source_metadata, source_data in sources:
        if source_id == str(user.id):
            continue
        portal = source_data if mock_data_enabled() else source_metadata.get("teacher_portal", {})
        for evaluation in portal.get("evaluations", []):
            class_key = (evaluation.get("grade"), evaluation.get("section"))
            if class_key in homeroom_classes:
                received.append({
                    **evaluation,
                    "id": f"{source_id}:{evaluation.get('id', '')}",
                    "evaluator": f'{source_metadata.get("last_name", "")} {source_metadata.get("first_name", "")}'.strip(),
                })
    return sorted(received, key=lambda item: (item.get("evaluation_date", ""), item.get("createdAt", "")), reverse=True)

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
        },
        "attendance": teacher_attendance_records(user),
        "trainings": portal.get("trainings", []),
        "evaluations": portal.get("evaluations", []),
        "program_plan": portal.get("program_plan"),
        "activities": portal.get("activities", []),
        "awards": portal.get("awards", []),
        "professional_degrees": portal.get("professional_degrees", []),
        "teaching_classes": portal.get("teaching_classes", []),
        "homeroom_evaluations": homeroom_evaluations(user),
    }
