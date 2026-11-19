from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException

from database import supabase
from schemas.teachers import PublicHolidayCreate


def _client():
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase backend тохируулагдаагүй байна.")
    return supabase


def list_public_holidays(year: int) -> list[dict[str, str]]:
    if not 1900 <= year <= 2200:
        raise HTTPException(status_code=422, detail="Оны утга буруу байна.")
    start = date(year, 1, 1).isoformat()
    end = date(year, 12, 31).isoformat()
    try:
        result = (
            _client().table("school_public_holidays")
            .select("holiday_date,name")
            .gte("holiday_date", start)
            .lte("holiday_date", end)
            .order("holiday_date")
            .execute()
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Бүх нийтийн амралтын өдрүүдийг уншиж чадсангүй.") from error
    return [
        {
            "date": str(row["holiday_date"])[:10],
            "name": str(row.get("name") or "Бүх нийтийн амралт"),
        }
        for row in (result.data or [])
    ]


def save_public_holiday(year: int, holiday: PublicHolidayCreate, user: Any) -> dict[str, str]:
    if not 1900 <= year <= 2200:
        raise HTTPException(status_code=422, detail="Оны утга буруу байна.")
    if holiday.holiday_date.year != year:
        raise HTTPException(status_code=422, detail="Амралтын өдөр сонгосон онтой таарах ёстой.")
    record = {
        "holiday_date": holiday.holiday_date.isoformat(),
        "name": holiday.name,
        "created_by": str(user.id),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        _client().table("school_public_holidays").upsert(
            record,
            on_conflict="holiday_date",
        ).execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Бүх нийтийн амралтын өдрийг хадгалж чадсангүй.") from error
    return {"date": holiday.holiday_date.isoformat(), "name": holiday.name}


def delete_public_holiday(year: int, holiday_date: date) -> None:
    if not 1900 <= year <= 2200:
        raise HTTPException(status_code=422, detail="Оны утга буруу байна.")
    if holiday_date.year != year:
        raise HTTPException(status_code=422, detail="Амралтын өдөр сонгосон онтой таарах ёстой.")
    try:
        _client().table("school_public_holidays").delete().eq(
            "holiday_date",
            holiday_date.isoformat(),
        ).execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Бүх нийтийн амралтын өдрийг устгаж чадсангүй.") from error
