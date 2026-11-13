import math
from typing import Any

import httpx


SUPABASE_FREE_DATABASE_LIMIT_MB = 500.0
SUPABASE_FREE_STORAGE_LIMIT_MB = 1024.0
RENDER_FREE_BANDWIDTH_LIMIT_GB = 100.0
__all__ = [
    "SUPABASE_FREE_DATABASE_LIMIT_MB",
    "SUPABASE_FREE_STORAGE_LIMIT_MB",
    "RENDER_FREE_BANDWIDTH_LIMIT_GB",
    "_number",
    "_api_error_detail",
    "_point",
    "_json_payload",
    "_provider",
]


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
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
    detail = error.get("message") or error.get("detail") if isinstance(error, dict) else error or payload.get("message") or payload.get("detail")
    return f": {' '.join(detail.split())[:240]}" if isinstance(detail, str) else ""


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
