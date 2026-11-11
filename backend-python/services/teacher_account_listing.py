import os
from typing import Any
from fastapi import HTTPException
from database import supabase
from services.attendance_automation import ensure_today_attendance, school_today
from services.mock_school_data import load_mock_school_data, mock_data_enabled

def list_teacher_accounts() -> list[dict[str, Any]]:
    ensure_today_attendance()
    if mock_data_enabled():
        accounts = []
        today = school_today().isoformat()
        for index, teacher in enumerate(load_mock_school_data()["teachers"], start=1):
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
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Багшийн жагсаалтыг Supabase-ээс уншиж чадсангүй.") from error

    teachers = []
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for user in users:
        metadata = user.user_metadata or {}
        app_metadata = user.app_metadata or {}
        email = (user.email or "").lower()
        if app_metadata.get("role") in {"admin", "manager"} or email == admin_email:
            continue
        if metadata.get("role") != "teacher" and not email.endswith("@moes.edu.mn"):
            continue
        portal = metadata.get("teacher_portal", {})
        attendance_records = app_metadata.get("teacher_attendance", [])
        latest_attendance = max(attendance_records, key=lambda item: item.get("date", ""), default={})
        weekly_hours = sum(item.get("weekly_hours", 0) for item in portal.get("teaching_classes", []))
        latest_month = max((item.get("date", "")[:7] for item in attendance_records), default="")
        month_records = [item for item in attendance_records if item.get("date", "").startswith(latest_month)]
        monthly_rate = round(
            sum(item.get("status") == "Ирсэн" for item in month_records) / len(month_records) * 100
        ) if month_records else 0
        teachers.append({
            "id": len(teachers) + 1,
            "auth_id": user.id,
            "last_name": metadata.get("last_name", ""),
            "first_name": metadata.get("first_name", ""),
            "email": user.email or "",
            "unit": metadata.get("unit", "БАЗАН"),
            "subject": metadata.get("subject", ""),
            "attendance": latest_attendance.get("status", "Ирсэн"),
            "monthly_attendance_rate": monthly_rate,
            "training_status": "Хамрагдсан" if portal.get("trainings") else "Хамрагдаагүй",
            "training_records": portal.get("trainings", []),
            "evaluation_records": portal.get("evaluations", []),
            "rating": 0,
            "monthly_login_count": 0,
            "lms_username": metadata.get("lms_username", ""),
            "daily_records": attendance_records,
            "teaching_classes": portal.get("teaching_classes", []),
            "weekly_teaching_hours": weekly_hours,
            "overtime_hours": max(0, weekly_hours - 19),
        })
    return teachers
