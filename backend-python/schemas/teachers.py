from datetime import date

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator

TRAINING_TYPES = {"Үндсэн", "Төрөлжсөн", "Сонголтот", "Ажлын байран дээрх сургалт", "Бусад"}

class TeacherCreate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    unit: str
    subject: str = Field(min_length=1)
    password: str | None = Field(default=None, min_length=8)

    @field_validator("first_name", "last_name", "email", "subject")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Энэ талбар хоосон байж болохгүй.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if len(value) < 8:
            raise ValueError("Нууц үг дор хаяж 8 тэмдэгт байна.")
        return value


class TeacherUpdate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    unit: str
    subject: str = Field(min_length=1)

    @field_validator("first_name", "last_name", "subject")
    @classmethod
    def reject_blank_update_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Энэ талбар хоосон байж болохгүй.")
        return value


class ManagerCreate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)

    @field_validator("first_name", "last_name", "email")
    @classmethod
    def reject_blank_manager_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Энэ талбар хоосон байж болохгүй.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 6:
            raise ValueError("Менежерийн нууц үг дор хаяж 6 тэмдэгт байна.")
        return value


class PasswordUpdate(BaseModel):
    password: str = Field(min_length=8)


class TrainingCreate(BaseModel):
    name: str = Field(min_length=1)
    startDate: date
    endDate: date
    trainingType: str = Field(default="Бусад", min_length=1)
    certificateUrl: str = Field(min_length=1)
    imageUrl: str | None = None

    @field_validator("name", "certificateUrl", "trainingType")
    @classmethod
    def reject_blank_values(cls, value: str, info: ValidationInfo) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Энэ талбар хоосон байж болохгүй.")
        if info.field_name == "trainingType" and value not in TRAINING_TYPES:
            raise ValueError("Сургалтын төрөл буруу байна.")
        return value


class AttendanceUpdate(BaseModel):
    date: date
    status: str


class TeachingClass(BaseModel):
    grade: int = Field(ge=1, le=12)
    section: str = Field(min_length=1, max_length=1)
    weekly_hours: int = Field(ge=0)
    homeroom: bool = False

    @model_validator(mode="after")
    def validate_zero_hours(self):
        if self.weekly_hours == 0 and not self.homeroom:
            raise ValueError("0 цагтай анги зөвхөн АУБ анги байж болно.")
        return self


class TeachingClassesUpdate(BaseModel):
    classes: list[TeachingClass]


VALID_UNITS = {"БАЗАН", "БУЗАН", "НУЗАН"}
VALID_ATTENDANCE = {"Ирсэн", "Хоцорсон", "Чөлөөтэй", "Өвчтэй", "Тасалсан"}
