import os
from datetime import datetime, timezone
from typing import Any

import httpx

from services.data_usage_common import (
    SUPABASE_FREE_DATABASE_LIMIT_MB,
    SUPABASE_FREE_STORAGE_LIMIT_MB,
    _api_error_detail,
    _json_payload,
    _number,
    _point,
    _provider,
)

__all__ = ["_supabase"]


async def _supabase(client: httpx.AsyncClient) -> dict[str, Any]:
    token = os.getenv("SUPABASE_ACCESS_TOKEN", "").strip()
    project_ref = os.getenv("SUPABASE_PROJECT_REF", "").strip()
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    metrics = []
    errors = []
    attempted = False

    if token and project_ref:
        attempted = True
        try:
            response = await client.get(
                f"https://api.supabase.com/v1/projects/{project_ref}/analytics/endpoints/usage.api-counts",
                params={"interval": "1day"},
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            rows = _json_payload(response, "Supabase", dict).get("result", [])
            if not isinstance(rows, list):
                raise ValueError("Supabase API буруу бүтэцтэй өгөгдөл буцаалаа.")
        except httpx.HTTPStatusError as error:
            errors.append(f"Supabase API алдаа ({error.response.status_code}){_api_error_detail(error.response)}; Management API эрхийг шалгана уу.")
        except httpx.RequestError:
            errors.append("Supabase Management API-д холбогдож чадсангүй.")
        except ValueError:
            errors.append("Supabase Management API буруу форматтай өгөгдөл буцаалаа.")
        else:
            for label, key in [
                ("REST хүсэлт", "total_rest_requests"),
                ("Auth хүсэлт", "total_auth_requests"),
                ("Realtime хүсэлт", "total_realtime_requests"),
                ("Storage хүсэлт", "total_storage_requests"),
            ]:
                points = [
                    point
                    for row in rows
                    if isinstance(row, dict)
                    if (point := _point(row.get("timestamp"), row.get(key))) is not None
                ]
                if points:
                    metrics.append({"name": label, "unit": "хүсэлт", "points": points})

    if supabase_url and service_key:
        attempted = True
        try:
            response = await client.post(
                f"{supabase_url}/rest/v1/rpc/get_usage_sizes",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            )
            response.raise_for_status()
            sizes = _json_payload(response, "Supabase", dict)
            database_size = _number(sizes.get("database_size_mb"))
            storage_size = _number(sizes.get("storage_size_mb"))
            if database_size is None or database_size < 0 or storage_size is None or storage_size < 0:
                raise ValueError("Supabase хэмжээний RPC дутуу эсвэл буруу утга буцаалаа.")
        except httpx.HTTPStatusError as error:
            errors.append(f"Supabase хэмжээний RPC алдаа ({error.response.status_code}){_api_error_detail(error.response)}; get_usage_sizes SQL migration-г ажиллуулсан эсэхийг шалгана уу.")
        except httpx.RequestError:
            errors.append("Supabase REST API-д холбогдож чадсангүй.")
        except ValueError:
            errors.append("Supabase хэмжээний RPC буруу форматтай өгөгдөл буцаалаа.")
        else:
            today = datetime.now(timezone.utc).date().isoformat()
            metrics.extend([
                {
                    "name": "Өгөгдлийн сан",
                    "unit": "MB",
                    "points": [{"date": today, "value": database_size}],
                    "total": database_size,
                    "limit": SUPABASE_FREE_DATABASE_LIMIT_MB,
                },
                {
                    "name": "File Storage",
                    "unit": "MB",
                    "points": [{"date": today, "value": storage_size}],
                    "total": storage_size,
                    "limit": SUPABASE_FREE_STORAGE_LIMIT_MB,
                },
            ])
    elif token or project_ref:
        attempted = True
        errors.append("Supabase API request history авахын тулд SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF хоёуланг тохируулна уу.")
    elif supabase_url or service_key:
        attempted = True
        errors.append("Өгөгдлийн сангийн хэмжээ авахын тулд SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY хоёуланг тохируулна уу.")

    if metrics:
        return _provider("supabase", "Supabase", "connected", metrics, "; ".join(errors) if errors else None)
    if attempted:
        return _provider("supabase", "Supabase", "error", message="; ".join(errors))
    return _provider(
        "supabase",
        "Supabase",
        "not_configured",
        message=(
            "Usage хэмжүүр авахын тулд Management API-ийн "
            "SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF болон REST API-ийн "
            "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY тохируулна уу."
        ),
    )
