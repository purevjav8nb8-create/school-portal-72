from io import BytesIO
from typing import Any
from urllib.parse import quote
from fastapi import HTTPException
from openpyxl import Workbook
from database import supabase
from services.school_announcements import _is_admin
from services.teacher_portal import teacher_portal_data
from services.school_surveys_common import _survey_owner

def export_survey_xlsx(current_user, survey_id: str) -> tuple[bytes, str]:
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Энэ үйлдлийг зөвхөн админ хийх боломжтой.")

    users = supabase.auth.admin.list_users(per_page=1000)
    admin = _survey_owner(users)
    if admin is None:
        raise HTTPException(status_code=404, detail="Судалгаа олдсонгүй.")

    survey = next(
        (item for item in (admin.app_metadata or {}).get("school_surveys", []) if item.get("id") == survey_id),
        None,
    )
    if survey is None:
        raise HTTPException(status_code=404, detail="Судалгаа олдсонгүй.")

    questions = survey.get("questions", [])
    if not questions:
        questions = [{"text": "Асуулт 1"}]
    question_titles = [
        question if isinstance(question, str) else question.get("text", "")
        for question in questions
    ]

    workbook = Workbook()
    answers_sheet = workbook.active
    answers_sheet.title = "Хариултууд"
    def append_text_row(sheet, values: list[Any]) -> None:
        sheet.append(values)
        for cell in sheet[sheet.max_row]:
            if isinstance(cell.value, str):
                cell.data_type = "s"

    append_text_row(answers_sheet, ["Багш", *question_titles, "Илгээсэн огноо"])
    summary_sheet = workbook.create_sheet("Нэгтгэл")
    append_text_row(summary_sheet, ["Асуулт", "Хариулт", "Хариултын тоо"])
    counts: dict[int, dict[str, int]] = {}

    for user in users:
        if _is_admin(user):
            continue
        responses = [
            response
            for response in teacher_portal_data(user).get("survey_responses", [])
            if str(response.get("survey_id", "")) == survey_id
        ]
        if not responses:
            continue

        metadata = user.user_metadata or {}
        teacher_name = (
            f'{metadata.get("last_name", "")} {metadata.get("first_name", "")}'.strip()
            or user.email
            or "Нэргүй багш"
        )
        answer_by_question: dict[int, Any] = {}
        submitted_at = ""
        for response in responses:
            try:
                question_index = int(response.get("question_index", 0))
            except (TypeError, ValueError):
                continue
            if not 0 <= question_index < len(question_titles):
                continue
            answer = response.get("option", response.get("answer", ""))
            answer_by_question[question_index] = answer
            submitted_at = max(submitted_at, str(response.get("submittedAt", "")))
            values = answer if isinstance(answer, list) else [answer]
            question_counts = counts.setdefault(question_index, {})
            for value in values:
                text = str(value)
                question_counts[text] = question_counts.get(text, 0) + 1

        append_text_row(answers_sheet, [
            teacher_name,
            *[
                "、".join(map(str, answer_by_question.get(index, [])))
                if isinstance(answer_by_question.get(index), list)
                else str(answer_by_question.get(index, ""))
                for index in range(len(question_titles))
            ],
            submitted_at,
        ])

    for question_index, question_title in enumerate(question_titles):
        for answer, count in sorted(counts.get(question_index, {}).items()):
            append_text_row(summary_sheet, [question_title, answer, count])

    for sheet in workbook.worksheets:
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for column in sheet.columns:
            width = max((len(str(cell.value or "")) for cell in column), default=0)
            sheet.column_dimensions[column[0].column_letter].width = min(max(width + 2, 12), 60)

    output = BytesIO()
    workbook.save(output)
    filename = f'{survey.get("title", "sudalgaa")}-hariult.xlsx'
    safe_filename = quote(filename)
    return output.getvalue(), safe_filename
