from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from urllib.parse import quote
from services.teacher_service import get_teachers_list
import pandas as pd
import io

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/export/excel")
def export_teachers_excel(
    unit: str = Query("НИЙТ"),
    category: str = Query("Ирц"),
    month: str = Query("2026-03")
):
    try:
        teachers = get_teachers_list()
        if unit != "НИЙТ":
            teachers = [t for t in teachers if t["unit"] == unit]

        export_data = []
        for t in teachers:
            item = {
                "Овог": t["last_name"],
                "Нэр": t["first_name"],
                "Нэгдэл": t["unit"],
                "Мэргэжил": t["subject"],
            }
            if category == "Ирц":
                item["Өнөөдрийн ирц"] = t["attendance"]
                item["Сарын ирцийн хувь"] = f"{t['monthly_attendance_rate']}%"
            elif category == "Сургалт":
                item["Сургалтын төлөв"] = t["training_status"]
            elif category == "Үнэлгээ":
                item["Үнэлгээний оноо"] = t["rating"]
                
            export_data.append(item)

        df = pd.DataFrame(export_data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Report")
        output.seek(0)

        filename = f"Report_{unit}_{category}_{month}.xlsx"
        encoded_filename = quote(filename)

        return StreamingResponse(
            output, 
            headers={'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"}, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export/pdf")
def export_teachers_pdf(
    unit: str = Query("НИЙТ"),
    category: str = Query("Ирц"),
    month: str = Query("2026-03")
):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors

        teachers = get_teachers_list()
        if unit != "НИЙТ":
            teachers = [t for t in teachers if t["unit"] == unit]

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()

        title_text = f"School Portal 72 - {unit} ({category} report - {month})"
        elements.append(Paragraph(f"<b>{title_text}</b>", styles['Title']))
        elements.append(Spacer(1, 12))

        if category == "Ирц":
            headers = ["Last Name", "First Name", "Unit", "Subject", "Status", "Rate"]
            col_widths = [80, 80, 80, 100, 80, 60]
        elif category == "Сургалт":
            headers = ["Last Name", "First Name", "Unit", "Subject", "Training"]
            col_widths = [90, 90, 90, 110, 100]
        else:
            headers = ["Last Name", "First Name", "Unit", "Subject", "Score"]
            col_widths = [90, 90, 90, 110, 100]

        table_data = [headers]
        for t in teachers:
            if category == "Ирц":
                row = [t["last_name"], t["first_name"], t["unit"], t["subject"], t["attendance"], f"{t['monthly_attendance_rate']}%"]
            elif category == "Сургалт":
                row = [t["last_name"], t["first_name"], t["unit"], t["subject"], t["training_status"]]
            else:
                row = [t["last_name"], t["first_name"], t["unit"], t["subject"], f"{t['rating']} pts"]
            table_data.append(row)

        t = Table(table_data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(t)
        doc.build(elements)
        buffer.seek(0)

        filename = f"Report_{unit}_{category}_{month}.pdf"
        encoded_filename = quote(filename)

        return StreamingResponse(
            buffer,
            headers={'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"},
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))