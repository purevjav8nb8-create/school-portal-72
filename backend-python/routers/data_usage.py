import httpx
from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from services.data_usage import get_provider_usage
from services.teacher_auth import require_admin
from services.vercel_analytics import get_vercel_web_analytics
from services.vercel_monthly_usage import get_vercel_monthly_usage, save_vercel_monthly_usage

router = APIRouter(tags=["Data usage"])


class VercelMonthlyUsageUpdate(BaseModel):
    fast_data_transfer_gb: float = Field(ge=0, allow_inf_nan=False)
    fast_origin_transfer_gb: float = Field(ge=0, allow_inf_nan=False)
    cdn_requests: int = Field(ge=0)
    isr_reads: int = Field(ge=0)


@router.get("/data-usage")
async def get_data_usage(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return {"providers": await get_provider_usage()}


@router.get("/data-usage/vercel-monthly")
async def get_vercel_monthly_data_usage(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        return await get_vercel_monthly_usage(client)


@router.get("/data-usage/vercel-analytics")
async def get_vercel_analytics_data_usage(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        return await get_vercel_web_analytics(client)


@router.put("/data-usage/vercel-monthly")
async def update_vercel_monthly_data_usage(
    usage: VercelMonthlyUsageUpdate,
    authorization: str | None = Header(default=None),
):
    require_admin(authorization)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        return await save_vercel_monthly_usage(client, usage.model_dump())
