import math
import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException


_COLUMNS = (
    "month,fast_data_transfer_gb,fast_origin_transfer_gb,cdn_requests,isr_reads,updated_at"
)


def _configuration() -> tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Сарын Vercel хэрэглээг хадгалахын тулд backend дээр "
                "SUPABASE_URL болон SUPABASE_SERVICE_ROLE_KEY тохируулна уу."
            ),
        )
    return supabase_url, service_key


def _current_month() -> str:
    return datetime.now(ZoneInfo("Asia/Ulaanbaatar")).strftime("%Y-%m")


def _empty_usage(month: str) -> dict[str, Any]:
    return {
        "month": month,
        "fast_data_transfer_gb": 0.0,
        "fast_origin_transfer_gb": 0.0,
        "cdn_requests": 0,
        "isr_reads": 0,
        "updated_at": None,
    }


def _number(value: Any, field: str, *, integer: bool = False) -> int | float:
    if isinstance(value, bool):
        raise ValueError(f"{field} утга буруу байна.")
    if integer:
        if isinstance(value, int):
            number = value
        elif isinstance(value, str) and value.isdigit():
            number = int(value)
        else:
            raise ValueError(f"{field} бүхэл тоо байх ёстой.")
    elif isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value.strip())
        except ValueError as error:
            raise ValueError(f"{field} тоо байх ёстой.") from error
    else:
        raise ValueError(f"{field} утга буруу байна.")

    if number < 0 or (not integer and not math.isfinite(number)):
        raise ValueError(f"{field} сөрөг эсвэл хязгааргүй байж болохгүй.")
    return number


def _usage_from_row(row: dict[str, Any], month: str) -> dict[str, Any]:
    if row.get("month") != month:
        return _empty_usage(month)
    updated_at = row.get("updated_at")
    if updated_at is not None and not isinstance(updated_at, str):
        raise ValueError("Supabase updated_at утга буруу байна.")
    try:
        return {
            "month": month,
            "fast_data_transfer_gb": _number(row.get("fast_data_transfer_gb"), "Fast Data Transfer"),
            "fast_origin_transfer_gb": _number(row.get("fast_origin_transfer_gb"), "Fast Origin Transfer"),
            "cdn_requests": _number(row.get("cdn_requests"), "CDN Requests", integer=True),
            "isr_reads": _number(row.get("isr_reads"), "ISR Reads", integer=True),
            "updated_at": updated_at,
        }
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


def _request_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }


async def _read_rows(response: httpx.Response) -> list[dict[str, Any]]:
    if response.is_error:
        if response.status_code == 404:
            raise HTTPException(
                status_code=503,
                detail=(
                    "vercel_monthly_usage хүснэгт олдсонгүй. "
                    "backend-python/migrations доторх Vercel usage migration-г Supabase дээр ажиллуулна уу."
                ),
            )
        try:
            payload = response.json()
        except ValueError:
            payload = None
        detail = ""
        if isinstance(payload, dict):
            error = payload.get("message") or payload.get("details") or payload.get("hint")
            if isinstance(error, str):
                detail = f": {' '.join(error.split())[:200]}"
        raise HTTPException(
            status_code=502,
            detail=f"Supabase Vercel usage API алдаа ({response.status_code}){detail}",
        )
    try:
        payload = response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=502,
            detail="Supabase Vercel usage API JSON өгөгдөл буруу.",
        ) from error
    if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
        raise HTTPException(
            status_code=502,
            detail="Supabase Vercel usage API буруу бүтэцтэй өгөгдөл буцаалаа.",
        )
    return payload


async def get_vercel_monthly_usage(client: httpx.AsyncClient) -> dict[str, Any]:
    supabase_url, service_key = _configuration()
    month = _current_month()
    try:
        response = await client.get(
            f"{supabase_url}/rest/v1/vercel_monthly_usage",
            params={"id": "eq.1", "select": _COLUMNS},
            headers=_request_headers(service_key),
        )
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=503,
            detail="Supabase REST API-д холбогдож чадсангүй.",
        ) from error
    rows = await _read_rows(response)
    if not rows:
        return _empty_usage(month)
    if len(rows) != 1:
        raise HTTPException(
            status_code=502,
            detail="Supabase Vercel usage хүснэгтэд давхар бичлэг байна.",
        )
    return _usage_from_row(rows[0], month)


async def save_vercel_monthly_usage(
    client: httpx.AsyncClient,
    usage: dict[str, int | float],
) -> dict[str, Any]:
    supabase_url, service_key = _configuration()
    month = _current_month()
    payload = {
        "id": 1,
        "month": month,
        **usage,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        response = await client.post(
            f"{supabase_url}/rest/v1/vercel_monthly_usage",
            params={"on_conflict": "id", "select": _COLUMNS},
            headers={
                **_request_headers(service_key),
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
            json=payload,
        )
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=503,
            detail="Supabase REST API-д холбогдож чадсангүй.",
        ) from error
    rows = await _read_rows(response)
    if len(rows) != 1:
        raise HTTPException(
            status_code=502,
            detail="Supabase Vercel usage бичлэгийг хадгалж чадсангүй.",
        )
    return _usage_from_row(rows[0], month)
