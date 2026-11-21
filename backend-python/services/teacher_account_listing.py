import os
from typing import Any
from fastapi import HTTPException
from database import supabase
from services.attendance_automation import ensure_today_attendance, has_teacher_identity, school_today
from services.mock_school_data import load_mock_school_data, mock_data_enabled
from services.teacher_portal_storage import list_teacher_portal_data_by_id, list_teacher_profiles

def list_teacher_accounts() -> list[dict[str, Any]]:
    if mock_data_enabled():
        ensure_today_attendance()
        accounts = []
        today = school_today().isoformat()
        for index, teacher in enumerate(load_mock_school_data()["teachers"], start=1):
            if not has_teacher_identity(teacher):
                continue
            attendance_records = teacher.get("attendance", [])
            accounts.append({
                "id": index,
                "auth_id": teacher["auth_id"],
                "last_name": teacher["last_name"],
                "first_name": teacher["first_name"],
                "email": teacher["email"],
                "unit": teacher["unit"],
                "subject": teacher["subject"],
                "attendance": max(
                    attendance_records,
                    key=lambda item: item.get("date", ""),
                    default={"status": "Ирсэн"},
                ).get("status", "Ирсэн"),
                "monthly_attendance_rate": 0,
                "training_status": "Хамрагдаагүй",
                "training_records": [],
                "evaluation_records": [],
                "rating": 0,
                "monthly_login_count": 0,
                "teaching_classes": teacher.get("teaching_classes", []),
                "weekly_teaching_hours": sum(
                    item.get("weekly_hours", 0) for item in teacher.get("teaching_classes", [])
                ),
                "overtime_hours": max(
                    0,
                    sum(item.get("weekly_hours", 0) for item in teacher.get("teaching_classes", [])) - 19,
                ),
                "lms_username": "",
                "daily_records": attendance_records,
            })
        return accounts
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    profiles = [profile for profile in list_teacher_profiles() if has_teacher_identity(profile)]
    ensure_today_attendance(profiles)
    portal_by_teacher = list_teacher_portal_data_by_id()
    teacher_ids = [
        str(profile["user_id"])
        for profile in profiles
        if profile.get("role") == "teacher"
    ]
    try:
        attendance_result = (
            supabase.table("teacher_attendance")
            .select("teacher_id,attendance_date,status")
            .in_("teacher_id", teacher_ids)
            .order("attendance_date")
            .execute()
        ) if teacher_ids else None
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн ирцийг Supabase-ээс уншиж чадсангүй.") from error
    attendance_by_teacher: dict[str, list[dict[str, str]]] = {}
    for row in (attendance_result.data or []) if attendance_result else []:
        attendance_by_teacher.setdefault(row["teacher_id"], []).append({
            "date": row["attendance_date"],
            "status": row["status"],
        })

    teachers = []
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for profile in profiles:
        user_id = str(profile["user_id"])
        email = str(profile.get("email", "")).lower()
        if profile.get("role") in {"admin", "manager"} or email == admin_email:
            continue
        if profile.get("role") != "teacher":
            continue
        portal = portal_by_teacher.get(user_id, {})
        attendance_records = attendance_by_teacher.get(user_id, [])
        latest_attendance = max(attendance_records, key=lambda item: item.get("date", ""), default={})
        weekly_hours = sum(item.get("weekly_hours", 0) for item in portal.get("teaching_classes", []))
        latest_month = max((item.get("date", "")[:7] for item in attendance_records), default="")
        month_records = [item for item in attendance_records if item.get("date", "").startswith(latest_month)]
        monthly_rate = round(
            sum(item.get("status") == "Ирсэн" for item in month_records) / len(month_records) * 100
        ) if month_records else 0
        teachers.append({
            "id": len(teachers) + 1,
            "auth_id": user_id,
            "last_name": profile.get("last_name", ""),
            "first_name": profile.get("first_name", ""),
            "email": profile.get("email", ""),
            "unit": profile.get("unit") or "БАЗАН",
            "subject": profile.get("subject", ""),
            "attendance": latest_attendance.get("status", "Ирсэн"),
            "monthly_attendance_rate": monthly_rate,
            "training_status": "Хамрагдсан" if portal.get("trainings") else "Хамрагдаагүй",
            "training_records": portal.get("trainings", []),
            "evaluation_records": portal.get("evaluations", []),
            "rating": 0,
            "monthly_login_count": 0,
            "lms_username": profile.get("lms_username", ""),
            "daily_records": attendance_records,
            "teaching_classes": portal.get("teaching_classes", []),
            "weekly_teaching_hours": weekly_hours,
            "overtime_hours": max(0, weekly_hours - 19),
        })
    return teachers
