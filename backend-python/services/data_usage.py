import asyncio

import httpx

from services.data_usage_cloudinary import _cloudinary
from services.data_usage_common import (
    RENDER_FREE_BANDWIDTH_LIMIT_GB,
    SUPABASE_FREE_DATABASE_LIMIT_MB,
    SUPABASE_FREE_STORAGE_LIMIT_MB,
    _api_error_detail,
    _json_payload,
    _number,
    _point,
    _provider,
)
from services.data_usage_render import _render
from services.data_usage_supabase import _supabase

__all__ = [
    "get_provider_usage",
    "_cloudinary",
    "_supabase",
    "_render",
    "_number",
    "_api_error_detail",
    "_point",
    "_json_payload",
    "_provider",
    "SUPABASE_FREE_DATABASE_LIMIT_MB",
    "SUPABASE_FREE_STORAGE_LIMIT_MB",
    "RENDER_FREE_BANDWIDTH_LIMIT_GB",
]


async def get_provider_usage() -> list[dict]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
        return await asyncio.gather(
            _cloudinary(client),
            _supabase(client),
            _render(client),
        )
