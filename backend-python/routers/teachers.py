from fastapi import APIRouter
from services.teacher_service import get_teachers_list

router = APIRouter(prefix="/api/teachers", tags=["Teachers"])

@router.get("")
def get_teachers():
    return get_teachers_list()