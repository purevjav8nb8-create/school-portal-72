import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from services.data_usage_common import _api_error_detail, _json_payload, _number, _provider

__all__ = ["_cloudinary"]


async def _cloudinary(client: httpx.AsyncClient) -> dict[str, Any]:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not cloud_name or not api_key or not api_secret:
        return _provider("cloudinary", "Cloudinary", "not_configured", message="CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET тохируулна уу.")

    today = datetime.now(timezone.utc).date()
    dates = [(today - timedelta(days=offset)).isoformat() for offset in range(7, 0, -1)]
    semaphore = asyncio.Semaphore(2)

    async def get_usage(params: dict[str, str] | None = None) -> dict[str, Any]:
        async with semaphore:
            response = await client.get(
                f"https://api.cloudinary.com/v1_1/{cloud_name}/usage",
                params=params,
                auth=(api_key, api_secret),
            )
        response.raise_for_status()
        return _json_payload(response, "Cloudinary", dict)

    try:
        current_usage, *daily_usage = await asyncio.gather(
            get_usage(),
            *(get_usage({"date": day}) for day in dates),
        )
    except httpx.HTTPStatusError as error:
        return _provider("cloudinary", "Cloudinary", "error", message=f"Cloudinary API алдаа ({error.response.status_code}){_api_error_detail(error.response)}; API эрх, тохиргоог шалгана уу.")
    except httpx.RequestError:
        return _provider("cloudinary", "Cloudinary", "error", message="Cloudinary API-д холбогдож чадсангүй.")
    except ValueError:
        return _provider("cloudinary", "Cloudinary", "error", message="Cloudinary API буруу форматтай өгөгдөл буцаалаа.")

    metrics = []
    credits = current_usage.get("credits")
    if isinstance(credits, dict):
        used = _number(credits.get("usage"))
        limit = _number(credits.get("limit"))
        if used is not None and limit is not None and limit > 0:
            metrics.append({
                "name": "Сарын кредит",
                "unit": "кредит",
                "points": [{"date": today.isoformat(), "value": used}],
                "total": used,
                "limit": limit,
            })

    for label, unit, key in [
        ("Хадгалалт", "GB", "storage"),
        ("Траффик", "GB", "bandwidth"),
        ("Хөрвүүлэлт", "тоо", "transformations"),
    ]:
        points = []
        for day, data in zip(dates, daily_usage):
            usage = data.get(key)
            value = _number(usage.get("usage")) if isinstance(usage, dict) else None
            if value is not None:
                divisor = 1_000_000_000 if unit == "GB" else 1
                points.append({"date": day, "value": value / divisor})
        if points:
            latest_usage = daily_usage[-1].get(key)
            limit = _number(latest_usage.get("limit")) if isinstance(latest_usage, dict) else None
            divisor = 1_000_000_000 if unit == "GB" else 1
            metrics.append({
                "name": label,
                "unit": unit,
                "points": points,
                **({"limit": limit / divisor} if limit is not None else {}),
            })

    message = None if metrics else "Cloudinary API хэрэглээний хэмжүүр буцаасангүй."
    return _provider("cloudinary", "Cloudinary", "connected" if metrics else "no_data", metrics, message)
