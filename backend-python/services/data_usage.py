import asyncio
import math
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


SUPABASE_FREE_DATABASE_LIMIT_MB = 500.0
SUPABASE_FREE_STORAGE_LIMIT_MB = 1024.0
RENDER_FREE_BANDWIDTH_LIMIT_GB = 100.0


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value.strip())
        except ValueError:
            return None
    else:
        return None
    return number if math.isfinite(number) else None


def _api_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return ""
    if not isinstance(payload, dict):
        return ""
    error = payload.get("error")
    if isinstance(error, dict):
        detail = error.get("message") or error.get("detail")
    else:
        detail = error or payload.get("message") or payload.get("detail")
    if not isinstance(detail, str):
        return ""
    return f": {' '.join(detail.split())[:240]}"


def _point(timestamp: Any, value: Any) -> dict[str, Any] | None:
    number = _number(value)
    if not isinstance(timestamp, str) or number is None:
        return None
    return {"date": timestamp, "value": number}


def _json_payload(response: httpx.Response, provider: str, expected_type: type) -> Any:
    try:
        payload = response.json()
    except ValueError as error:
        raise ValueError(f"{provider} API JSON өгөгдөл буруу.") from error
    if not isinstance(payload, expected_type):
        raise ValueError(f"{provider} API буруу бүтэцтэй өгөгдөл буцаалаа.")
    return payload


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
    dates = [(today - timedelta(days=offset)).isoformat() for offset in range(7, 0, -1)]
    semaphore = asyncio.Semaphore(2)

    async def fetch_current_usage() -> dict[str, Any]:
        async with semaphore:
            response = await client.get(
                f"https://api.cloudinary.com/v1_1/{cloud_name}/usage",
                auth=(api_key, api_secret),
            )
        response.raise_for_status()
        return _json_payload(response, "Cloudinary", dict)

    async def fetch_day(day: str) -> tuple[str, dict[str, Any]]:
        async with semaphore:
            response = await client.get(
                f"https://api.cloudinary.com/v1_1/{cloud_name}/usage",
                params={"date": day},
                auth=(api_key, api_secret),
            )
        response.raise_for_status()
        return day, _json_payload(response, "Cloudinary", dict)

    try:
        current_usage, *daily_usage = await asyncio.gather(
            fetch_current_usage(),
            *(fetch_day(day) for day in dates),
        )
    except httpx.HTTPStatusError as error:
        return _provider("cloudinary", "Cloudinary", "error", message=f"Cloudinary API алдаа ({error.response.status_code}){_api_error_detail(error.response)}; API эрх, тохиргоог шалгана уу.")
    except httpx.RequestError:
        return _provider("cloudinary", "Cloudinary", "error", message="Cloudinary API-д холбогдож чадсангүй.")
    except ValueError:
        return _provider("cloudinary", "Cloudinary", "error", message="Cloudinary API буруу форматтай өгөгдөл буцаалаа.")

    definitions = [
        ("Хадгалалт", "GB", "storage"),
        ("Траффик", "GB", "bandwidth"),
        ("Хөрвүүлэлт", "тоо", "transformations"),
    ]
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

    for label, unit, key in definitions:
        points = []
        for day, data in daily_usage:
            usage = data.get(key)
            value = _number(usage.get("usage")) if isinstance(usage, dict) else None
            if value is not None:
                divisor = 1_000_000_000 if unit == "GB" else 1
                points.append({"date": day, "value": value / divisor})
        if points:
            latest_usage = daily_usage[-1][1].get(key)
            limit = _number(latest_usage.get("limit")) if isinstance(latest_usage, dict) else None
            divisor = 1_000_000_000 if unit == "GB" else 1
            metrics.append({
                "name": label,
                "unit": unit,
                "points": points,
                **({"limit": limit / divisor} if limit is not None else {}),
            })
    return _provider("cloudinary", "Cloudinary", "connected" if metrics else "no_data", metrics, None if metrics else "Cloudinary API хэрэглээний хэмжүүр буцаасангүй.")


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
            payload = _json_payload(response, "Supabase", dict)
            rows = payload.get("result", [])
            if not isinstance(rows, list):
                raise ValueError("Supabase API буруу бүтэцтэй өгөгдөл буцаалаа.")
        except httpx.HTTPStatusError as error:
            errors.append(f"Supabase API алдаа ({error.response.status_code}){_api_error_detail(error.response)}; Management API эрхийг шалгана уу.")
        except httpx.RequestError:
            errors.append("Supabase Management API-д холбогдож чадсангүй.")
        except ValueError:
            errors.append("Supabase Management API буруу форматтай өгөгдөл буцаалаа.")
        else:
            definitions = [
                ("REST хүсэлт", "хүсэлт", "total_rest_requests"),
                ("Auth хүсэлт", "хүсэлт", "total_auth_requests"),
                ("Realtime хүсэлт", "хүсэлт", "total_realtime_requests"),
                ("Storage хүсэлт", "хүсэлт", "total_storage_requests"),
            ]
            for label, unit, key in definitions:
                points = [point for row in rows if isinstance(row, dict) if (point := _point(row.get("timestamp"), row.get(key))) is not None]
                if points:
                    metrics.append({"name": label, "unit": unit, "points": points})

    if supabase_url and service_key:
        attempted = True
        try:
            response = await client.post(
                f"{supabase_url}/rest/v1/rpc/get_usage_sizes",
                headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                },
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


async def _render(client: httpx.AsyncClient) -> dict[str, Any]:
    token = os.getenv("RENDER_API_KEY", "").strip()
    resource_ids = [value.strip() for value in os.getenv("RENDER_RESOURCE_ID", "").split(",") if value.strip()]
    if not token or not resource_ids:
        return _provider("render", "Render", "not_configured", message="RENDER_API_KEY, RENDER_RESOURCE_ID тохируулна уу.")

    end = datetime.now(timezone.utc)
    start = datetime(end.year, end.month, 1, tzinfo=timezone.utc)
    params = {
        "resource": ",".join(resource_ids),
        "startTime": start.isoformat().replace("+00:00", "Z"),
        "endTime": end.isoformat().replace("+00:00", "Z"),
        "resolutionSeconds": 86_400,
    }
    definitions = [
        ("Сарын траффик", "/metrics/bandwidth", "GB", RENDER_FREE_BANDWIDTH_LIMIT_GB),
        ("Санах ой", "/metrics/memory", "MB", 512.0 * len(resource_ids)),
    ]

    async def fetch_metric(name: str, path: str, unit: str, limit: float) -> dict[str, Any] | None:
        response = await client.get(
            f"https://api.render.com/v1{path}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        series = _json_payload(response, "Render", list)
        values_by_timestamp: dict[str, float] = defaultdict(float)
        detected_unit = unit
        for item in series:
            if not isinstance(item, dict) or not isinstance(item.get("values"), list):
                raise ValueError("Render Metrics API буруу бүтэцтэй өгөгдөл буцаалаа.")
            series_unit = item.get("unit") or detected_unit
            for value in item["values"]:
                if not isinstance(value, dict):
                    raise ValueError("Render Metrics API буруу бүтэцтэй өгөгдөл буцаалаа.")
                point = _point(value.get("timestamp"), value.get("value"))
                if point:
                    values_by_timestamp[point["date"]] += point["value"]
                detected_unit = str(value.get("unit") or series_unit)
        unit_key = detected_unit.strip().lower()
        conversion_factors = {
            "GB": {
                "gb": 1.0,
                "gigabyte": 1.0,
                "gigabytes": 1.0,
                "mb": 1000.0,
                "megabyte": 1000.0,
                "megabytes": 1000.0,
                "mib": 1024.0,
                "mebibyte": 1024.0,
                "mebibytes": 1024.0,
                "b": 1_000_000_000.0,
                "byte": 1_000_000_000.0,
                "bytes": 1_000_000_000.0,
            },
            "MB": {
                "mb": 1.0,
                "megabyte": 1.0,
                "megabytes": 1.0,
                "mib": 1.0,
                "mebibyte": 1.0,
                "mebibytes": 1.0,
                "kb": 1000.0,
                "kilobyte": 1000.0,
                "kilobytes": 1000.0,
                "b": 1_000_000.0,
                "byte": 1_000_000.0,
                "bytes": 1_000_000.0,
                "gb": 0.001,
                "gigabyte": 0.001,
                "gigabytes": 0.001,
            },
        }
        divisor = conversion_factors[unit].get(unit_key)
        metric_unit = unit if divisor is not None else detected_unit
        if divisor is None:
            divisor = 1.0
            limit = None
        points = []
        running_total = 0.0
        is_cumulative = path == "/metrics/bandwidth"
        for date, daily_value in sorted(values_by_timestamp.items()):
            value = daily_value / divisor
            if is_cumulative:
                running_total += value
                value = running_total
            points.append({"date": date, "value": value})
        if not points:
            return None
        metric = {
            "name": name,
            "unit": metric_unit,
            "points": points,
            "total": points[-1]["value"],
        }
        if limit is not None:
            metric["limit"] = limit
        return metric

    try:
        metrics = [metric for metric in await asyncio.gather(*(fetch_metric(*definition) for definition in definitions)) if metric]
    except httpx.HTTPStatusError as error:
        return _provider("render", "Render", "error", message=f"Render API алдаа ({error.response.status_code}){_api_error_detail(error.response)}; API эрх болон resource ID-г шалгана уу.")
    except httpx.RequestError:
        return _provider("render", "Render", "error", message="Render API-д холбогдож чадсангүй.")
    except ValueError:
        return _provider("render", "Render", "error", message="Render API буруу форматтай өгөгдөл буцаалаа.")
    message = (
        "Энэ сарын траффик болон санах ойн хэрэглээг Render Metrics API-аас харуулж байна."
        if metrics
        else "Render API сарын траффик, санах ойн өгөгдөл буцаасангүй."
    )
    return _provider("render", "Render", "connected" if metrics else "no_data", metrics, message)


async def _vercel(client: httpx.AsyncClient) -> dict[str, Any]:
    token = os.getenv("VERCEL_TOKEN", "").strip()
    project_id = os.getenv("VERCEL_PROJECT_ID", "").strip()
    if not token or not project_id:
        return _provider(
            "vercel",
            "Vercel",
            "not_configured",
            message="Vercel төслийн холболтыг шалгахын тулд VERCEL_TOKEN, VERCEL_PROJECT_ID тохируулна уу.",
        )
    try:
        response = await client.get(
            f"https://api.vercel.com/v9/projects/{project_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        return _provider("vercel", "Vercel", "error", message=f"Vercel API алдаа ({error.response.status_code}){_api_error_detail(error.response)}; төслийн ID болон токений эрхийг шалгана уу.")
    except httpx.RequestError:
        return _provider("vercel", "Vercel", "error", message="Vercel API-д холбогдож чадсангүй.")
    try:
        project = _json_payload(response, "Vercel", dict)
    except ValueError:
        return _provider("vercel", "Vercel", "error", message="Vercel API буруу форматтай өгөгдөл буцаалаа.")
    if not isinstance(project.get("id"), str) or not isinstance(project.get("name"), str):
        return _provider("vercel", "Vercel", "error", message="Vercel API төслийн мэдээлэл буцаасангүй.")
    deployments = project.get("latestDeployments", [])
    if not isinstance(deployments, list) or any(not isinstance(item, dict) for item in deployments):
        return _provider("vercel", "Vercel", "error", message="Vercel API deployment мэдээлэл буруу форматтай байна.")

    message = f"Vercel төсөл ({project['name']}) амжилттай холбогдлоо."
    if deployments:
        latest = deployments[0]
        state = latest.get("readyState")
        deployment_url = latest.get("url")
        details = [value for value in (state, deployment_url) if isinstance(value, str) and value]
        if details:
            message += f" Сүүлийн deployment: {' — '.join(details)}."
    else:
        message += " Сүүлийн deployment-ийн мэдээлэл олдсонгүй."
    message += " Projects API хэрэглэсэн GB болон сарын квотын мэдээлэл өгдөггүй."

    return _provider(
        "vercel",
        "Vercel",
        "connected",
        message=message,
    )


async def get_provider_usage() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
        return await asyncio.gather(
            _cloudinary(client),
            _supabase(client),
            _render(client),
            _vercel(client),
        )
