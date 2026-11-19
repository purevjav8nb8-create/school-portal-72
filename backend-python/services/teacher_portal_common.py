from typing import Any
from fastapi import HTTPException
from database import supabase
from services.mock_school_data import mock_data_enabled
from services.teacher_portal_storage import (
    get_teacher_portal_data,
    save_teacher_portal_data as save_teacher_portal_records,
)

def teacher_portal_data(user) -> dict[str, Any]:
    return get_teacher_portal_data(user)

def teacher_attendance_records(user) -> list[dict[str, str]]:
    if mock_data_enabled():
        return (user.app_metadata or {}).get("teacher_attendance", [])
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    try:
        result = (
            supabase.table("teacher_attendance")
            .select("attendance_date,status")
            .eq("teacher_id", user.id)
            .order("attendance_date")
            .execute()
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail="Ирцийг Supabase-ээс уншиж чадсангүй.") from error
    return [
        {"date": item["attendance_date"], "status": item["status"]}
        for item in (result.data or [])
    ]

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
    return save_teacher_portal_records(user, portal_data)

def save_teacher_attendance(user, records: list[dict[str, str]]):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    rows = [
        {
            "teacher_id": user.id,
            "attendance_date": record["date"],
            "status": record["status"],
        }
        for record in records
    ]
    if not rows:
        return
    try:
        return supabase.table("teacher_attendance").upsert(
            rows,
            on_conflict="teacher_id,attendance_date",
        ).execute()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Ирцийг Supabase-д хадгалж чадсангүй.") from error
