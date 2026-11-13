import math
import os
from datetime import datetime, timezone
from typing import Any

import httpx


_ANALYTICS_ENDPOINT = "https://api.vercel.com/v1/query/web-analytics/visits/count"
_DEFAULT_PROJECT_ID = "portal72"


def _count(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Vercel {field} утга буруу байна.")
    if not math.isfinite(value) or value < 0 or int(value) != value:
        raise ValueError(f"Vercel {field} утга буруу байна.")
    return int(value)


def _result(
    *,
    month: str,
    status: str,
    pageviews: int | None = None,
    visitors: int | None = None,
    updated_at: str | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    return {
        "month": month,
        "status": status,
        "pageviews": pageviews,
        "visitors": visitors,
        "updated_at": updated_at,
        "message": message,
    }


async def get_vercel_web_analytics(client: httpx.AsyncClient) -> dict[str, Any]:
    today = datetime.now(timezone.utc).date()
    month = today.strftime("%Y-%m")
    token = os.getenv("VERCEL_TOKEN", "").strip()
    project_id = os.getenv("VERCEL_PROJECT_ID", _DEFAULT_PROJECT_ID).strip() or _DEFAULT_PROJECT_ID
    team_id = os.getenv("VERCEL_TEAM_ID", "").strip()

    if not token:
        return _result(
            month=month,
            status="not_configured",
            message="Vercel Web Analytics авахын тулд backend дээр VERCEL_TOKEN тохируулна уу.",
        )

    params = {
        "projectId": project_id,
        "since": today.replace(day=1).isoformat(),
        "until": today.isoformat(),
    }
    if team_id:
        params["teamId"] = team_id

    try:
        response = await client.get(
            _ANALYTICS_ENDPOINT,
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
    except httpx.RequestError:
        return _result(
            month=month,
            status="error",
            message="Vercel Web Analytics API-д холбогдож чадсангүй.",
        )

    if response.is_error:
        return _result(
            month=month,
            status="error",
            message=f"Vercel Web Analytics API алдаа ({response.status_code}); token, project ID болон Web Analytics тохиргоог шалгана уу.",
        )

    try:
        payload = response.json()
    except ValueError:
        return _result(
            month=month,
            status="error",
            message="Vercel Web Analytics API JSON өгөгдөл буруу.",
        )

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        return _result(
            month=month,
            status="error",
            message="Vercel Web Analytics API хүлээгдээгүй өгөгдөл буцаалаа.",
        )

    try:
        pageviews = _count(data.get("pageviews"), "pageviews")
        visitors = _count(data.get("visitors"), "visitors")
    except ValueError as error:
        return _result(month=month, status="error", message=str(error))

    return _result(
        month=month,
        status="connected",
        pageviews=pageviews,
        visitors=visitors,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
