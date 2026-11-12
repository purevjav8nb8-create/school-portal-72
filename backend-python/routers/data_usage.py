from fastapi import APIRouter, Header

from services.data_usage import get_provider_usage
from services.teacher_auth import require_admin

router = APIRouter(tags=["Data usage"])


@router.get("/data-usage")
async def get_data_usage(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return {"providers": await get_provider_usage()}
