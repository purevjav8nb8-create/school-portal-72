from io import BytesIO
from typing import Any
from urllib.parse import quote
from fastapi import HTTPException
from openpyxl import Workbook
from services.school_announcements import _is_admin
from services.teacher_portal_storage import get_school_survey, list_survey_responses

def export_survey_xlsx(current_user, survey_id: str) -> tuple[bytes, str]:
    row = get_school_survey(survey_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Судалгаа олдсонгүй.")

    survey = row.get("payload") or {}
    if str(survey.get("created_by", "")) != str(current_user.id) and "created_by" in survey:
        raise HTTPException(status_code=403, detail="Энэ судалгааны нэгтгэлийг зөвхөн оруулсан хэрэглэгч харах боломжтой.")
    if "created_by" not in survey and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Энэ судалгааны нэгтгэлийг зөвхөн оруулсан хэрэглэгч харах боломжтой.")

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

    grouped_responses: dict[str, list[dict[str, Any]]] = {}
    respondent_names: dict[str, str] = {}
    for response_row in list_survey_responses(survey_id):
        teacher_id = str(response_row.get("teacher_id", ""))
        grouped_responses.setdefault(teacher_id, []).append(response_row.get("payload") or {})
        respondent_names[teacher_id] = response_row.get("respondent_name") or "Нэргүй багш"

    for teacher_id, responses in grouped_responses.items():
        teacher_name = respondent_names.get(teacher_id, "Нэргүй багш")
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
