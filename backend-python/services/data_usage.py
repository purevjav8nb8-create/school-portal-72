import asyncio
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


def _number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def _point(timestamp: Any, value: Any) -> dict[str, Any] | None:
    number = _number(value)
    if not isinstance(timestamp, str) or number is None:
        return None
    return {"date": timestamp, "value": number}


def _provider(
    provider_id: str,
    name: str,
    status: str,
    metrics: list[dict[str, Any]] | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    return {
        "id": provider_id,
        "name": name,
        "status": status,
        "metrics": metrics or [],
        "message": message,
    }


async def _cloudinary(client: httpx.AsyncClient) -> dict[str, Any]:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not cloud_name or not api_key or not api_secret:
        return _provider("cloudinary", "Cloudinary", "not_configured", message="CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET тохируулна уу.")

    today = datetime.now(timezone.utc).date()
    dates = [(today - timedelta(days=offset)).isoformat() for offset in range(7, -1, -1)]
    semaphore = asyncio.Semaphore(2)

    async def fetch_day(day: str) -> tuple[str, dict[str, Any]]:
        async with semaphore:
            response = await client.get(
                f"https://api.cloudinary.com/v1_1/{cloud_name}/usage",
                params={"date": day},
                auth=(api_key, api_secret),
            )
        response.raise_for_status()
        return day, response.json()

    try:
        daily_usage = await asyncio.gather(*(fetch_day(day) for day in dates))
    except httpx.HTTPStatusError as error:
        return _provider("cloudinary", "Cloudinary", "error", message=f"Cloudinary API алдаа ({error.response.status_code}); API эрх, тохиргоог шалгана уу.")
    except httpx.RequestError:
        return _provider("cloudinary", "Cloudinary", "error", message="Cloudinary API-д холбогдож чадсангүй.")

    definitions = [
        ("Хадгалалт", "GB", lambda data: data.get("storage", {}).get("usage")),
        ("Траффик", "GB", lambda data: data.get("bandwidth", {}).get("usage")),
        ("Хөрвүүлэлт", "тоо", lambda data: data.get("transformations", {}).get("usage")),
    ]
    metrics = []
    for label, unit, get_value in definitions:
        points = []
        for day, data in daily_usage:
            value = get_value(data)
            if value is not None:
                divisor = 1_000_000_000 if unit == "GB" else 1
                points.append({"date": day, "value": float(value) / divisor})
        if points:
            metrics.append({"name": label, "unit": unit, "points": points})
    return _provider("cloudinary", "Cloudinary", "connected" if metrics else "no_data", metrics, None if metrics else "Cloudinary API хэрэглээний хэмжүүр буцаасангүй.")


async def _supabase(client: httpx.AsyncClient) -> dict[str, Any]:
    token = os.getenv("SUPABASE_ACCESS_TOKEN", "").strip()
    project_ref = os.getenv("SUPABASE_PROJECT_REF", "").strip()
    if not token or not project_ref:
        return _provider("supabase", "Supabase", "not_configured", message="SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF тохируулна уу.")

    try:
        response = await client.get(
            f"https://api.supabase.com/v1/projects/{project_ref}/analytics/endpoints/usage.api-counts",
            params={"interval": "1day"},
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        rows = response.json().get("result", [])
    except httpx.HTTPStatusError as error:
        return _provider("supabase", "Supabase", "error", message=f"Supabase API алдаа ({error.response.status_code}); Management API эрх, тохиргоог шалгана уу.")
    except httpx.RequestError:
        return _provider("supabase", "Supabase", "error", message="Supabase API-д холбогдож чадсангүй.")

    definitions = [
        ("REST хүсэлт", "хүсэлт", "total_rest_requests"),
        ("Auth хүсэлт", "хүсэлт", "total_auth_requests"),
        ("Realtime хүсэлт", "хүсэлт", "total_realtime_requests"),
        ("Storage хүсэлт", "хүсэлт", "total_storage_requests"),
    ]
    metrics = []
    if isinstance(rows, list):
        for label, unit, key in definitions:
            points = [point for row in rows if isinstance(row, dict) if (point := _point(row.get("timestamp"), row.get(key))) is not None]
            if points:
                metrics.append({"name": label, "unit": unit, "points": points})
    return _provider("supabase", "Supabase", "connected" if metrics else "no_data", metrics, None if metrics else "Supabase API хэрэглээний түүхэн өгөгдөл буцаасангүй.")


async def _render(client: httpx.AsyncClient) -> dict[str, Any]:
    token = os.getenv("RENDER_API_KEY", "").strip()
    resource_id = os.getenv("RENDER_RESOURCE_ID", "").strip()
    if not token or not resource_id:
        return _provider("render", "Render", "not_configured", message="RENDER_API_KEY, RENDER_RESOURCE_ID тохируулна уу.")

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    params = {
        "resource": resource_id,
        "startTime": start.isoformat(),
        "endTime": end.isoformat(),
    }
    definitions = [
        ("Траффик", "bandwidth", "/metrics/bandwidth"),
        ("CPU", "%", "/metrics/cpu"),
        ("Санах ой", "MB", "/metrics/memory"),
    ]

    async def fetch_metric(name: str, unit: str, path: str) -> dict[str, Any] | None:
        response = await client.get(
            f"https://api.render.com/v1{path}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        series = response.json()
        values_by_timestamp: dict[str, float] = defaultdict(float)
        detected_unit = unit
        for item in series if isinstance(series, list) else []:
            if not isinstance(item, dict):
                continue
            detected_unit = item.get("unit") or detected_unit
            for value in item.get("values", []):
                if isinstance(value, dict):
                    point = _point(value.get("timestamp"), value.get("value"))
                    if point:
                        values_by_timestamp[point["date"]] += point["value"]
                    detected_unit = value.get("unit") or detected_unit
        points = [{"date": date, "value": value} for date, value in sorted(values_by_timestamp.items())]
        return {"name": name, "unit": detected_unit, "points": points} if points else None

    try:
        metrics = [metric for metric in await asyncio.gather(*(fetch_metric(*definition) for definition in definitions)) if metric]
    except httpx.HTTPStatusError as error:
        return _provider("render", "Render", "error", message=f"Render API алдаа ({error.response.status_code}); API эрх болон resource ID-г шалгана уу.")
    except httpx.RequestError:
        return _provider("render", "Render", "error", message="Render API-д холбогдож чадсангүй.")
    return _provider("render", "Render", "connected" if metrics else "no_data", metrics, None if metrics else "Render API түүхэн хэмжүүр буцаасангүй.")


async def _vercel(client: httpx.AsyncClient) -> dict[str, Any]:
    token = os.getenv("VERCEL_TOKEN", "").strip()
    if not token:
        return _provider("vercel", "Vercel", "not_configured", message="VERCEL_TOKEN тохируулна уу. Үнэгүй багцын quota-г API-аар авах боломжгүй; endpoint нь төлбөрийн хэрэглээг харуулна.")

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    params = {"from": start.isoformat(), "to": end.isoformat()}
    team_id = os.getenv("VERCEL_TEAM_ID", "").strip()
    if team_id:
        params["teamId"] = team_id
    try:
        response = await client.get(
            "https://api.vercel.com/v1/billing/charges",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        return _provider("vercel", "Vercel", "error", message=f"Vercel API алдаа ({error.response.status_code}); токен, багийн ID болон billing эрхийг шалгана уу.")
    except httpx.RequestError:
        return _provider("vercel", "Vercel", "error", message="Vercel API-д холбогдож чадсангүй.")

    usage_by_series: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for line in response.text.splitlines():
        try:
            record = httpx.Response(200, text=line).json()
        except ValueError:
            continue
        if record.get("ChargeCategory") != "Usage":
            continue
        quantity = _number(record.get("ConsumedQuantity"))
        period = record.get("ChargePeriodStart")
        unit = record.get("ConsumedUnit")
        service = record.get("ServiceName")
        if quantity is None or not isinstance(period, str) or not isinstance(unit, str):
            continue
        series_name = (service if isinstance(service, str) else "Usage", unit)
        usage_by_series[series_name][period[:10]] += quantity

    metrics = [
        {
            "name": f"{service} ({unit})",
            "unit": unit,
            "points": [{"date": date, "value": value} for date, value in sorted(daily.items())],
        }
        for (service, unit), daily in usage_by_series.items()
    ]
    message = None if metrics else "Энэ хугацаанд Vercel billing API хэрэглээний мөр буцаасангүй. Үнэгүй багцын quota тусдаа API-аар нийтлэгддэггүй."
    return _provider("vercel", "Vercel", "connected" if metrics else "no_data", metrics, message)


async def get_provider_usage() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
        return await asyncio.gather(
            _cloudinary(client),
            _supabase(client),
            _render(client),
            _vercel(client),
        )
