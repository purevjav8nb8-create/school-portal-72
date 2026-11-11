import os
from typing import Any

from fastapi import HTTPException

from services.report_rows import rows_for_teacher
from services.teacher_accounts import list_teacher_accounts
from services.teacher_auth import get_authenticated_user, require_teacher
from services.teacher_portal import get_my_teacher_data

REPORT_CATEGORIES = {"Ирц", "Сургалт", "Үнэлгээ"}
REPORT_GRADE_BANDS = {"all", "primary", "middle", "high"}


def build_report_data(
	authorization: str | None,
	unit: str,
	category: str,
	month: str,
	grade_band: str = "all",
	subject: str = "",
) -> dict[str, Any]:
	if category not in REPORT_CATEGORIES:
		raise HTTPException(status_code=422, detail="Тайлангийн төрөл буруу байна.")
	if grade_band not in REPORT_GRADE_BANDS:
		raise HTTPException(status_code=422, detail="Ангийн сонголт буруу байна.")
	user = get_authenticated_user(authorization)
	admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
	is_admin = (user.app_metadata or {}).get("role") in {"admin", "manager"} or (user.email or "").lower() == admin_email

	if is_admin:
		teachers = list_teacher_accounts()
		selected_unit = str(unit or "НИЙТ").strip().upper()
		if selected_unit != "НИЙТ":
			teachers = [
				teacher for teacher in teachers
				if str(teacher.get("unit", "")).strip().upper() == selected_unit
			]
	else:
		selected_unit = str(unit or "").strip().upper()
		teacher_user = require_teacher(authorization)
		workspace = get_my_teacher_data(teacher_user)
		profile = workspace["profile"]
		teachers = [{
			**profile,
			"daily_records": workspace.get("attendance", []),
			"training_records": workspace.get("trainings", []),
			"evaluation_records": workspace.get("evaluations", []),
		}]

	rows = [
		row for teacher in teachers
		for row in rows_for_teacher(teacher, category, month, grade_band, subject)
	]
	return {
		"category": category,
		"unit": selected_unit,
		"month": month,
		"grade_band": grade_band,
		"subject": subject.strip(),
		"rows": rows,
	}
