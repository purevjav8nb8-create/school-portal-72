from datetime import datetime, timezone
import os
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from database import supabase
from services.mock_school_data import (
    get_mock_teacher_by_id,
    mock_data_enabled,
    update_mock_teacher_portal,
)


_PORTAL_TABLES = {
    "trainings": "teacher_trainings",
    "evaluations": "teacher_evaluations",
    "activities": "teacher_activities",
    "awards": "teacher_awards",
    "professional_degrees": "teacher_professional_degrees",
    "teaching_classes": "teacher_teaching_classes",
}
_PORTAL_COLLECTIONS = (
    "program_plan",
    "trainings",
    "evaluations",
    "activities",
    "awards",
    "professional_degrees",
    "teaching_classes",
    "survey_responses",
)


def _client():
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    return supabase


def _execute(query, detail: str):
    try:
        return query.execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail=detail) from error


def _rows(result) -> list[dict[str, Any]]:
    data = result.data or []
    return data if isinstance(data, list) else [data]


def _all_rows(query, detail: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = _rows(_execute(query.range(offset, offset + 999), detail))
        rows.extend(page)
        if len(page) < 1000:
            return rows
        offset += len(page)


def _teacher_details(user) -> tuple[str, str]:
    metadata = user.user_metadata or {}
    name = f'{metadata.get("last_name", "")} {metadata.get("first_name", "")}'.strip()
    return name or user.email or "", user.email or ""


def list_teacher_profiles() -> list[dict[str, Any]]:
    return _all_rows(
        _client().table("teacher_profiles").select(
            "user_id,email,first_name,last_name,unit,subject,role,lms_username"
        ),
        "Багшийн бүртгэл уншигдсангүй.",
    )


def save_teacher_profile(user) -> None:
    metadata = user.user_metadata or {}
    app_metadata = user.app_metadata or {}
    email = (user.email or "").lower()
    role = app_metadata.get("role") or metadata.get("role")
    if role not in {"teacher", "manager", "admin"}:
        role = "teacher" if email.endswith("@moes.edu.mn") else None
    if role is None:
        raise HTTPException(status_code=422, detail="Хэрэглэгчийн эрхийн төрөл тодорхойгүй байна.")
    _execute(
        _client().table("teacher_profiles").upsert(
            {
                "user_id": str(user.id),
                "email": user.email or "",
                "first_name": str(metadata.get("first_name") or ""),
                "last_name": str(metadata.get("last_name") or ""),
                "unit": str(metadata.get("unit") or ""),
                "subject": str(metadata.get("subject") or ""),
                "role": role,
                "lms_username": str(metadata.get("lms_username") or ""),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id",
        ),
        "Хэрэглэгчийн бүртгэлийг Supabase-д хадгалж чадсангүй.",
    )


def get_portal_collection(user_id: str, collection: str) -> Any:
    if collection not in _PORTAL_COLLECTIONS:
        raise ValueError(f"Unknown teacher portal collection: {collection}")
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(str(user_id))
        if teacher is None:
            return None if collection == "program_plan" else []
        return teacher.get(collection, [] if collection != "program_plan" else None)
    if collection == "program_plan":
        rows = _rows(_execute(
            _client().table("teacher_program_plans")
            .select("payload").eq("teacher_id", user_id),
            "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.",
        ))
        return rows[0].get("payload") if rows else None
    if collection == "survey_responses":
        query = (
            _client().table("teacher_survey_responses")
            .select("payload").eq("teacher_id", user_id)
            .order("record_order")
        )
        rows = _all_rows(query, "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.")
    else:
        table = _PORTAL_TABLES[collection]
        query = _client().table(table).select("payload").eq("teacher_id", user_id).order("record_order")
        rows = _all_rows(query, "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.")
    return [row["payload"] for row in rows if row.get("payload") is not None]


def get_teacher_portal_data(user) -> dict[str, Any]:
    if mock_data_enabled():
        teacher = get_mock_teacher_by_id(str(user.id))
        if teacher is None:
            return {}
        data = {key: teacher.get(key, [] if key != "program_plan" else None) for key in _PORTAL_COLLECTIONS}
        data["teaching_classes_updated_at"] = teacher.get("teaching_classes_updated_at")
        return data
    data = {key: get_portal_collection(str(user.id), key) for key in _PORTAL_COLLECTIONS}
    class_set = _rows(_execute(
        _client().table("teacher_teaching_class_sets").select("updated_at")
        .eq("teacher_id", str(user.id)),
        "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.",
    ))
    data["teaching_classes_updated_at"] = class_set[0].get("updated_at") if class_set else None
    return data


def list_teacher_portal_data_by_id() -> dict[str, dict[str, Any]]:
    data: dict[str, dict[str, Any]] = {}
    if mock_data_enabled():
        from services.mock_school_data import load_mock_school_data

        for teacher in load_mock_school_data()["teachers"]:
            data[str(teacher.get("auth_id", ""))] = {
                key: teacher.get(key, [] if key != "program_plan" else None)
                for key in _PORTAL_COLLECTIONS
            }
        return data

    for collection in _PORTAL_COLLECTIONS:
        rows = list_portal_records(collection)
        for row in rows:
            teacher_id = str(row.get("teacher_id", ""))
            if not teacher_id:
                continue
            portal = data.setdefault(
                teacher_id,
                {key: [] if key != "program_plan" else None for key in _PORTAL_COLLECTIONS},
            )
            if collection == "program_plan":
                portal["program_plan"] = row.get("payload")
            elif collection == "survey_responses":
                portal[collection].append(row.get("payload"))
            else:
                portal[collection].append(row.get("payload"))
    for portal in data.values():
        portal["teaching_classes_updated_at"] = None
    try:
        results = _all_rows(
            _client().table("teacher_teaching_class_sets").select("teacher_id,updated_at"),
            "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.",
        )
        for row in results:
            teacher_id = str(row.get("teacher_id", ""))
            portal = data.setdefault(
                teacher_id,
                {key: [] if key != "program_plan" else None for key in _PORTAL_COLLECTIONS},
            )
            portal["teaching_classes_updated_at"] = row.get("updated_at")
    except HTTPException:
        raise
    return data


def _delete_rows(table: str, user_id: str, keep_ids: set[str] | None = None) -> None:
    client = _client()
    rows = _all_rows(
        client.table(table).select("record_id").eq("teacher_id", user_id),
        "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.",
    )
    for row in rows:
        record_id = str(row.get("record_id", ""))
        if keep_ids is not None and record_id in keep_ids:
            continue
        _execute(
            client.table(table).delete().eq("teacher_id", user_id).eq("record_id", record_id),
            "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.",
        )


def replace_portal_collection(
    user,
    collection: str,
    values: Any,
    updated_at: str | None = None,
) -> None:
    if collection not in _PORTAL_COLLECTIONS:
        raise ValueError(f"Unknown teacher portal collection: {collection}")
    if mock_data_enabled():
        try:
            update_mock_teacher_portal(str(user.id), {collection: values})
            return
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.") from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    client = _client()
    user_id = str(user.id)
    if collection == "program_plan":
        query = client.table("teacher_program_plans").delete().eq("teacher_id", user_id)
        if values is not None:
            _execute(
                client.table("teacher_program_plans").upsert(
                    {
                        "teacher_id": user_id,
                        "payload": values,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    on_conflict="teacher_id",
                ),
                "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.",
            )
            return
        _execute(query, "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.")
        return

    if not isinstance(values, list):
        raise ValueError(f"{collection} must be a list")
    if collection == "survey_responses":
        table = "teacher_survey_responses"
        name, _ = _teacher_details(user)
        rows = []
        for index, value in enumerate(values):
            survey_id = str(value.get("survey_id", ""))
            question_index = int(value.get("question_index", 0))
            rows.append({
                "teacher_id": user_id,
                "survey_id": survey_id,
                "question_index": question_index,
                "record_order": index,
                "payload": value,
                "respondent_name": name,
            })
        existing = _all_rows(
            client.table(table).select("survey_id,question_index").eq("teacher_id", user_id),
            "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.",
        )
        if rows:
            _execute(
                client.table(table).upsert(rows, on_conflict="teacher_id,survey_id,question_index"),
                "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.",
            )
        keep_keys = {(str(row["survey_id"]), int(row["question_index"])) for row in rows}
        for row in existing:
            key = (str(row.get("survey_id", "")), int(row.get("question_index", 0)))
            if key not in keep_keys:
                _execute(
                    client.table(table).delete().eq("teacher_id", user_id)
                    .eq("survey_id", key[0]).eq("question_index", key[1]),
                    "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.",
                )
        return

    table = _PORTAL_TABLES[collection]
    name, email = _teacher_details(user)
    rows = []
    for index, value in enumerate(values):
        payload = dict(value)
        record_id = str(payload.get("id") or uuid4())
        rows.append({
            "teacher_id": user_id,
            "record_id": record_id,
            "record_order": index,
            "payload": payload,
            "teacher_name": name,
            "teacher_email": email,
        })
    if rows:
        _execute(
            client.table(table).upsert(rows, on_conflict="teacher_id,record_id"),
            "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.",
        )
    _delete_rows(table, user_id, {str(row["record_id"]) for row in rows})
    if collection == "teaching_classes":
        _execute(
            client.table("teacher_teaching_class_sets").upsert(
                {
                    "teacher_id": user_id,
                    "updated_at": updated_at or datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="teacher_id",
            ),
            "Багшийн мэдээллийг Supabase-д хадгалж чадсангүй.",
        )


def save_teacher_portal_data(user, portal_data: dict[str, Any]):
    if mock_data_enabled():
        try:
            updates = {key: value for key, value in portal_data.items() if key in _PORTAL_COLLECTIONS}
            return update_mock_teacher_portal(str(user.id), updates)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.") from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
    for key in _PORTAL_COLLECTIONS:
        value = portal_data.get(key, None if key == "program_plan" else [])
        replace_portal_collection(
            user,
            key,
            value,
            updated_at=portal_data.get("teaching_classes_updated_at")
            if key == "teaching_classes" else None,
        )


def list_portal_records(collection: str) -> list[dict[str, Any]]:
    if collection == "program_plan":
        table = "teacher_program_plans"
    elif collection == "survey_responses":
        table = "teacher_survey_responses"
    else:
        table = _PORTAL_TABLES[collection]
    query = _client().table(table).select("*")
    if collection not in {"program_plan", "survey_responses"}:
        query = query.order("record_order")
    return _all_rows(query, "Багшийн мэдээллийг Supabase-ээс уншиж чадсангүй.")


def list_school_announcements() -> list[dict[str, Any]]:
    return _all_rows(
        _client().table("school_announcements").select("owner_id,payload"),
        "Зар уншигдсангүй.",
    )


def save_school_announcement(user, announcement: dict[str, Any]) -> None:
    metadata = user.app_metadata or {}
    owner_email = (user.email or "").lower()
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    owner_type = "admin" if metadata.get("role") in {"admin", "manager"} or owner_email == admin_email else "teacher"
    _execute(
        _client().table("school_announcements").upsert({
            "id": str(announcement["id"]),
            "owner_id": str(user.id),
            "owner_type": owner_type,
            "payload": announcement,
        }, on_conflict="id"),
        "Зарыг хадгалж чадсангүй.",
    )


def list_school_surveys() -> list[dict[str, Any]]:
    return _all_rows(
        _client().table("school_surveys").select("id,owner_id,payload"),
        "Судалгаа уншигдсангүй.",
    )


def get_school_survey(survey_id: str) -> dict[str, Any] | None:
    rows = _rows(_execute(
        _client().table("school_surveys").select("id,owner_id,payload").eq("id", survey_id),
        "Судалгаа уншигдсангүй.",
    ))
    return rows[0] if rows else None


def save_school_survey(user, survey: dict[str, Any]) -> None:
    _execute(
        _client().table("school_surveys").upsert({
            "id": str(survey["id"]),
            "owner_id": str(user.id),
            "created_by": str(survey.get("created_by", user.id)),
            "payload": survey,
        }, on_conflict="id"),
        "Судалгааг хадгалж чадсангүй.",
    )


def delete_school_survey(survey_id: str) -> None:
    _execute(
        _client().table("school_surveys").delete().eq("id", survey_id),
        "Судалгааг устгаж чадсангүй.",
    )


def save_survey_responses(user, responses: list[dict[str, Any]]) -> None:
    replace_portal_collection(user, "survey_responses", responses)


def list_survey_responses(survey_id: str | None = None) -> list[dict[str, Any]]:
    query = _client().table("teacher_survey_responses").select(
        "teacher_id,payload,respondent_name"
    )
    if survey_id is not None:
        query = query.eq("survey_id", survey_id)
    return _all_rows(query, "Судалгааны хариултыг уншиж чадсангүй.")
