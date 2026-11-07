import html
import io
import os
from datetime import date
from urllib.parse import quote

import pandas as pd
from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse

from services.report_data import build_report_data

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _get_report(authorization: str | None, unit: str, category: str, month: str):
    report_month = month or date.today().strftime("%Y-%m")
    return build_report_data(authorization, unit, category, report_month)


def _filename(report: dict, extension: str) -> str:
    return quote(f"Report_{report['unit']}_{report['category']}_{report['month']}.{extension}")


@router.get("/preview")
def preview_report(
    authorization: str | None = Header(default=None),
    unit: str = Query("НИЙТ"),
    category: str = Query("Ирц"),
    month: str = Query(""),
):
    return _get_report(authorization, unit, category, month)


@router.get("/export/excel")
def export_teachers_excel(
    authorization: str | None = Header(default=None),
    unit: str = Query("НИЙТ"),
    category: str = Query("Ирц"),
    month: str = Query(""),
):
    report = _get_report(authorization, unit, category, month)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(report["rows"]).to_excel(writer, index=False, sheet_name="Тайлан")
    output.seek(0)
    return StreamingResponse(
        output,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_filename(report, 'xlsx')}"},
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/export/pdf")
def export_teachers_pdf(
    authorization: str | None = Header(default=None),
    unit: str = Query("НИЙТ"),
    category: str = Query("Ирц"),
    month: str = Query(""),
    disposition: str = Query("attachment"),
):
    report = _get_report(authorization, unit, category, month)
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as error:
        raise HTTPException(status_code=503, detail="PDF тайлангийн сан тохируулагдаагүй байна.") from error

    font_path = os.getenv("REPORT_FONT_PATH") or next((
        path for path in (r"C:\Windows\Fonts\arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        if os.path.exists(path)
    ), "")
    font_name = "Helvetica"
    if font_path:
        try:
            pdfmetrics.registerFont(TTFont("SchoolReportFont", font_path))
            font_name = "SchoolReportFont"
        except Exception:
            pass

    rows = report["rows"]
    columns = list(rows[0]) if rows else ["Мэдээлэл"]
    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle("ReportCell", parent=styles["BodyText"], fontName=font_name, fontSize=8, leading=10)
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], fontName=font_name, fontSize=14)
    table_data = [[Paragraph(html.escape(str(column)), cell_style) for column in columns]]
    table_data.extend([[Paragraph(html.escape(str(row.get(column, ""))), cell_style) for column in columns] for row in rows])

    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4), repeatRows=1)
    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    document.build([
        Paragraph(f"School Portal 72 · {html.escape(report['unit'])} · {html.escape(report['category'])} · {report['month']}", title_style),
        Spacer(1, 14),
        table,
    ])
    output.seek(0)
    response_mode = "inline" if disposition == "inline" else "attachment"
    return StreamingResponse(
        output,
        headers={"Content-Disposition": f"{response_mode}; filename*=UTF-8''{_filename(report, 'pdf')}"},
        media_type="application/pdf",
    )
