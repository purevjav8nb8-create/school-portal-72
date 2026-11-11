from typing import Any
from fastapi import HTTPException
from database import supabase
from services.mock_school_data import mock_data_enabled, update_mock_teacher_portal

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
    if mock_data_enabled():
        try:
            return update_mock_teacher_portal(user.id, portal_data)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Загвар багш олдсонгүй.") from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

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
