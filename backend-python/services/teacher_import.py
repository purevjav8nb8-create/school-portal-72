from typing import Any

import pandas as pd
from fastapi import HTTPException, UploadFile

from schemas.teachers import TeacherCreate
from services.teacher_accounts import create_teacher_account


REQUIRED_COLUMNS = {"first_name", "last_name", "email", "unit", "subject"}
COLUMN_ALIASES = {
    "first_name": ("first name", "given name", "нэр"),
    "last_name": ("last name", "family name", "овог"),
    "email": ("moes", "moes email", "moes address", "moes хаяг"),
    "password": ("pass", "moes pass", "moes password", "moes нууц үг"),
    "unit": ("нэгж",),
    "subject": ("мэргэжил", "заах хичээл"),
}


def _normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    frame.columns = [" ".join(str(column).strip().lower().replace("_", " ").split()) for column in frame.columns]
    for canonical, aliases in COLUMN_ALIASES.items():
        if canonical in frame.columns:
            continue
        source = next((alias for alias in aliases if alias in frame.columns), None)
        if source:
            frame = frame.rename(columns={source: canonical})
    return frame


def import_teacher_file(file: UploadFile) -> dict[str, list[dict[str, Any]]]:
    suffix = (file.filename or "").lower().rsplit(".", 1)[-1]
    try:
        if suffix == "xlsx":
            frame = pd.read_excel(file.file)
        elif suffix == "csv":
            frame = pd.read_csv(file.file, encoding="utf-8-sig")
        else:
            raise HTTPException(status_code=415, detail="CSV эсвэл XLSX файл сонгоно уу.")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail="Файлыг уншиж чадсангүй.") from error

    frame = _normalize_columns(frame)
    if not REQUIRED_COLUMNS.issubset(frame.columns):
        missing = ", ".join(sorted(REQUIRED_COLUMNS - set(frame.columns)))
        raise HTTPException(status_code=422, detail=f"Дутуу багана: {missing}")

    created = []
    failed = []
    for row_number, row in enumerate(frame.to_dict(orient="records"), start=2):
        try:
            values = {
                key: "" if pd.isna(row.get(key)) else str(row.get(key)).strip()
                for key in REQUIRED_COLUMNS
            }
            password = row.get("password")
            if password is not None and not pd.isna(password) and str(password).strip():
                values["password"] = str(password).strip()
            created.append(create_teacher_account(TeacherCreate(**values)))
        except Exception as error:
            detail = error.detail if isinstance(error, HTTPException) else "Мөрийн мэдээлэл хүчинтэй биш."
            failed.append({"row": row_number, "detail": detail})
    return {"created": created, "failed": failed}
