import calendar
from typing import Any


def _teacher_name(teacher: dict[str, Any]) -> str:
	last_name = str(teacher.get("last_name", "")).strip()
	first_name = str(teacher.get("first_name", "")).strip()
	initial = f"{last_name[0]}." if last_name else ""
	return " ".join(part for part in (initial, first_name) if part)


def _attendance_mark(status: Any) -> str:
	marks = {
		"Ирсэн": "И",
		"Өвчтэй": "Ө",
		"Тасалсан": "Т",
		"Чөлөөтэй": "Ч",
		"Хоцорсон": "Х",
	}
	return marks.get(str(status).strip(), "")


def rows_for_teacher(
	teacher: dict[str, Any],
	category: str,
	month: str,
	grade_band: str = "all",
	subject: str = "",
) -> list[dict[str, Any]]:
	if category == "Ирц":
		year = month_number = None
		try:
			year, month_number = (int(value) for value in month.split("-", 1))
			days_in_month = calendar.monthrange(year, month_number)[1]
		except (TypeError, ValueError):
			days_in_month = 31

		attendance_by_day = {
			item.get("date", "")[-2:]: item.get("status", "")
			for item in teacher.get("daily_records", [])
			if item.get("date", "").startswith(month)
		}
		working_days = [
			day for day in range(1, days_in_month + 1)
			if calendar.weekday(year, month_number, day) < 5
		] if year is not None and month_number is not None else list(range(1, days_in_month + 1))
		return [{
			"Хичээл": teacher.get("subject", ""),
			**{str(day): _attendance_mark(attendance_by_day.get(f"{day:02d}", "")) for day in working_days},
			"Багш": _teacher_name(teacher),
		}]
	if category == "Сургалт":
		trainings = teacher.get("training_records", [])
		if not trainings:
			return [{"Хичээл": teacher.get("subject", ""), "Сургалтын нэр": "Бүртгэгдээгүй", "Багш": _teacher_name(teacher)}]
		return [{
			"Хичээл": teacher.get("subject", ""),
			"Сургалтын нэр": item.get("name", ""),
			"Эхэлсэн": item.get("startDate", ""),
			"Дууссан": item.get("endDate", ""),
			"Сертификат": item.get("certificateUrl", ""),
			"Багш": _teacher_name(teacher),
		} for item in trainings]

	evaluations = [
		item for item in teacher.get("evaluation_records", [])
		if item.get("evaluation_date", "").startswith(month)
		and int(item.get("students_count", 0) or 0) > 0
		and str(item.get("subject") or "").strip()
	]
	selected_subject = subject.strip().casefold()
	if grade_band == "primary":
		evaluations = [item for item in evaluations if 1 <= int(item.get("grade", 0) or 0) <= 5]
	elif grade_band == "middle":
		evaluations = [item for item in evaluations if 6 <= int(item.get("grade", 0) or 0) <= 9]
	elif grade_band == "high":
		evaluations = [item for item in evaluations if 10 <= int(item.get("grade", 0) or 0) <= 12]
	if selected_subject:
		evaluations = [
			item for item in evaluations
			if str(item.get("subject") or "").strip().casefold() == selected_subject
		]
	if not evaluations:
		return []

	grouped: dict[tuple[Any, str], list[dict[str, Any]]] = {}
	for item in evaluations:
		record_subject = str(item.get("subject") or "").strip()
		key = (item.get("grade"), record_subject.casefold())
		grouped.setdefault(key, []).append(item)

	levels = ("VIII", "VII", "VI", "V", "IV", "III", "II", "I")
	rows = []
	for (grade, _), entries in grouped.items():
		counts = {level: 0 for level in levels}
		weighted_total = 0.0
		student_total = 0
		record_subject = str(entries[0].get("subject") or "").strip()
		for item in entries:
			level = item.get("level")
			count = int(item.get("students_count", 0) or 0)
			if level in counts:
				counts[level] += count
			weighted_total += float(item.get("average_score", 0) or 0) * count
			student_total += count
		rows.append({
			"Нэгтгэл": grade,
			"Хичээл": record_subject or "",
			**counts,
			"Нийт": student_total,
			"Дундаж": round(weighted_total / student_total, 1) if student_total else 0,
			"Багш": _teacher_name(teacher),
		})
	return rows
