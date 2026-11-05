import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from io import BytesIO

def generate_excel_report(attendance_data: list) -> BytesIO:
    """
    Багш нарын ирцийн мэдээллийг Excel тайлан болгон загварчилж экспортлоно.
    """
    df = pd.DataFrame(attendance_data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Ирцийн тайлан', index=False)
        
        workbook = writer.book
        worksheet = writer.sheets['Ирцийн тайлан']
        
        # Загваржуулалт (Styling)
        header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center")
        
        for col in worksheet.iter_cols(min_row=1, max_row=1):
            for cell in col:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = center_align

        # Баганын өргөнийг автоматаар тохируулах
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 5, 12)
            
    output.seek(0)
    return output