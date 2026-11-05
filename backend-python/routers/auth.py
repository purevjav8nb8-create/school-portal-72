from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.teacher_service import get_teachers_list

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginSchema(BaseModel):
    username_or_email: str
    password: str

@router.post("/login")
async def login(credentials: LoginSchema):
    identifier = credentials.username_or_email.strip().lower()
    password = credentials.password.strip()

    if identifier == "admin":
        if password == "admin":
            return {
                "status": "success",
                "user": {
                    "last_name": "Системийн",
                    "first_name": "Админ",
                    "email": "admin@moes.edu.mn",
                    "role": "admin",
                    "unit": "Захиргаа",
                    "subject": "Администратор"
                }
            }
        raise HTTPException(status_code=401, detail="Админы нууц үг буруу байна!")

    if not identifier.endswith("@moes.edu.mn"):
        raise HTTPException(status_code=400, detail="Багш нар сургуулийн албан и-мэйл хаягаа оруулна уу! (@moes.edu.mn)")

    teachers = get_teachers_list()
    found = next((t for t in teachers if t["email"] == identifier), None)
    if found:
        return {
            "status": "success",
            "user": {
                "last_name": found["last_name"],
                "first_name": found["first_name"],
                "email": found["email"],
                "unit": found["unit"],
                "subject": found["subject"],
                "role": "teacher",
                "lms_username": found["lms_username"]
            }
        }

    raise HTTPException(status_code=401, detail="И-мэйл эсвэл нууц үг буруу байна!")