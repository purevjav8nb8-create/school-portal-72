import asyncio
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import httpx

from services.data_usage_common import (
    RENDER_FREE_BANDWIDTH_LIMIT_GB,
    _api_error_detail,
    _json_payload,
    _point,
    _provider,
)


_UNIT_FACTORS = {
    "GB": {
        "gb": 1.0, "gigabyte": 1.0, "gigabytes": 1.0,
        "mb": 1000.0, "megabyte": 1000.0, "megabytes": 1000.0,
        "mib": 1024.0, "mebibyte": 1024.0, "mebibytes": 1024.0,
        "b": 1_000_000_000.0, "byte": 1_000_000_000.0, "bytes": 1_000_000_000.0,
    },
    "MB": {
        "mb": 1.0, "megabyte": 1.0, "megabytes": 1.0,
        "mib": 1.0, "mebibyte": 1.0, "mebibytes": 1.0,
        "kb": 1000.0, "kilobyte": 1000.0, "kilobytes": 1000.0,
        "b": 1_000_000.0, "byte": 1_000_000.0, "bytes": 1_000_000.0,
        "gb": 0.001, "gigabyte": 0.001, "gigabytes": 0.001,
    },
}
__all__ = ["_render"]


async def _fetch_metric(
    client: httpx.AsyncClient,
    token: str,
    params: dict[str, Any],
    name: str,
    path: str,
    unit: str,
    limit: float | None,
) -> dict[str, Any] | None:
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

    divisor = _UNIT_FACTORS[unit].get(detected_unit.strip().lower())
    metric_unit = unit if divisor is not None else detected_unit
    if divisor is None:
        divisor = 1.0
        limit = None
    total = 0.0
    points = []
    for timestamp, raw_value in sorted(values_by_timestamp.items()):
        value = raw_value / divisor
        if path == "/metrics/bandwidth":
            total += value
            value = total
        points.append({"date": timestamp, "value": value})
    if not points:
        return None

    metric = {"name": name, "unit": metric_unit, "points": points, "total": points[-1]["value"]}
    if limit is not None:
        metric["limit"] = limit
    return metric


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

    try:
        metrics = [
            metric for metric in await asyncio.gather(*(
                _fetch_metric(client, token, params, *definition) for definition in definitions
            ))
            if metric
        ]
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
