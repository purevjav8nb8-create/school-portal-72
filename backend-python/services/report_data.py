import os
from typing import Any

from fastapi import HTTPException

from services.teacher_accounts import list_teacher_accounts
from services.teacher_auth import get_authenticated_user, require_teacher
from services.teacher_portal import get_my_teacher_data

REPORT_CATEGORIES = {"Ирц", "Сургалт", "Үнэлгээ"}


def _base_row(teacher: dict[str, Any]) -> dict[str, Any]:
	return {
		"Овог": teacher.get("last_name", ""),
		"Нэр": teacher.get("first_name", ""),
		"Нэгдэл": teacher.get("unit", ""),
		"Мэргэжил": teacher.get("subject", ""),
	}


def _rows_for_teacher(teacher: dict[str, Any], category: str, month: str) -> list[dict[str, Any]]:
	base = _base_row(teacher)
	if category == "Ирц":
		records = [item for item in teacher.get("daily_records", []) if item.get("date", "").startswith(month)]
		if not records:
			return [{**base, "Огноо": month, "Ирц": "Бүртгэгдээгүй"}]
		return [{**base, "Огноо": item["date"], "Ирц": item["status"]} for item in records]
	if category == "Сургалт":
		trainings = teacher.get("training_records", [])
		if not trainings:
			return [{**base, "Сургалтын нэр": "Бүртгэгдээгүй"}]
		return [{
			**base,
			"Сургалтын нэр": item.get("name", ""),
			"Эхэлсэн": item.get("startDate", ""),
			"Дууссан": item.get("endDate", ""),
			"Сертификат": item.get("certificateUrl", ""),
		} for item in trainings]

	evaluations = [
		item for item in teacher.get("evaluation_records", [])
		if item.get("evaluation_date", "").startswith(month)
	]
	if not evaluations:
		return [{**base, "Анги": "", "Хичээл": "", "Түвшин": "", "Үнэлэгдсэн хүүхэд": 0, "Дундаж": 0}]
	return [{
		**base,
		"Анги": f"{item.get('grade', '')}-{item.get('section', '')}",
		"Хичээл": item.get("subject", ""),
		"Түвшин": item.get("level", ""),
		"Үнэлэгдсэн хүүхэд": item.get("students_count", 0),
		"Дундаж": item.get("average_score", 0),
		"Огноо": item.get("evaluation_date", ""),
	} for item in evaluations]


def build_report_data(authorization: str | None, unit: str, category: str, month: str) -> dict[str, Any]:
	if category not in REPORT_CATEGORIES:
		raise HTTPException(status_code=422, detail="Тайлангийн төрөл буруу байна.")
	user = get_authenticated_user(authorization)
	admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
	is_admin = (user.app_metadata or {}).get("role") == "admin" or (user.email or "").lower() == admin_email

	if is_admin:
		teachers = list_teacher_accounts()
		if unit != "НИЙТ":
			teachers = [teacher for teacher in teachers if teacher.get("unit") == unit]
	else:
		teacher_user = require_teacher(authorization)
		workspace = get_my_teacher_data(teacher_user)
		profile = workspace["profile"]
		teachers = [{
			**profile,
			"daily_records": workspace.get("attendance", []),
			"training_records": workspace.get("trainings", []),
			"evaluation_records": workspace.get("evaluations", []),
		}]

	rows = [row for teacher in teachers for row in _rows_for_teacher(teacher, category, month)]
	return {"category": category, "unit": unit, "month": month, "rows": rows}
