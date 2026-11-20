from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

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


class PublicHolidayCreate(BaseModel):
    holiday_date: date
    name: str = Field(default="Бүх нийтийн амралт", min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def reject_blank_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Амралтын өдрийн нэр хоосон байж болохгүй.")
        return value


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


class HomeroomClass(BaseModel):
    grade: int = Field(ge=1, le=12)
    section: str = Field(min_length=1, max_length=1)


class HomeroomClassesUpdate(BaseModel):
    classes: list[HomeroomClass] = Field(max_length=5)

    @model_validator(mode="after")
    def reject_duplicate_classes(self):
        keys = [(item.grade, item.section) for item in self.classes]
        if len(keys) != len(set(keys)):
            raise ValueError("Даасан анги давхардаж болохгүй.")
        return self


class AcademicTerm(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    grades: list[int] = Field(default_factory=list, max_length=12)
    modality: Literal["in_person", "online"] = "in_person"

    @field_validator("name")
    @classmethod
    def reject_blank_term_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Улирлын нэр хоосон байж болохгүй.")
        return value

    @field_validator("grades")
    @classmethod
    def validate_term_grades(cls, value: list[int]) -> list[int]:
        if any(grade < 1 or grade > 12 for grade in value):
            raise ValueError("Анги 1-12-ын хооронд байна.")
        if len(value) != len(set(value)):
            raise ValueError("Улирлын анги давхардаж болохгүй.")
        return sorted(value)

    @model_validator(mode="after")
    def validate_term_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("Улирлын дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй.")
        return self


class AcademicYearUpdate(BaseModel):
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    start_date: date
    end_date: date
    terms: list[AcademicTerm] = Field(min_length=1, max_length=24)

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year_range(cls, value: str) -> str:
        start, end = (int(part) for part in value.split("-"))
        if end != start + 1:
            raise ValueError("Хичээлийн жил дараалсан хоёр он байна.")
        return value

    @model_validator(mode="after")
    def validate_year_structure(self):
        start_year, end_year = (int(part) for part in self.academic_year.split("-"))
        if self.start_date.year != start_year or self.end_date.year != end_year:
            raise ValueError("Хичээлийн жилийн огноо сонгосон онтой таарах ёстой.")
        if self.end_date < self.start_date:
            raise ValueError("Хичээлийн жил дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй.")
        term_ids = [term.id for term in self.terms]
        if len(term_ids) != len(set(term_ids)):
            raise ValueError("Улирлын дугаар давхардаж болохгүй.")
        for term in self.terms:
            if term.start_date < self.start_date or term.end_date > self.end_date:
                raise ValueError("Улирлын огноо хичээлийн жилийн хүрээнээс хэтэрч болохгүй.")
        for index, term in enumerate(self.terms):
            for other in self.terms[index + 1:]:
                overlapping_grades = not term.grades or not other.grades or bool(set(term.grades) & set(other.grades))
                dates_overlap = term.start_date <= other.end_date and other.start_date <= term.end_date
                if overlapping_grades and dates_overlap:
                    raise ValueError(f"{term.name} болон {other.name} улирлын огноо давхцаж байна.")
        return self


class SubstituteHoursEntry(BaseModel):
    teacher_id: UUID
    hours: Decimal = Field(ge=0, le=400)


class SubstituteHoursUpdate(BaseModel):
    entries: list[SubstituteHoursEntry] = Field(max_length=1000)

    @model_validator(mode="after")
    def reject_duplicate_teachers(self):
        teacher_ids = [item.teacher_id for item in self.entries]
        if len(teacher_ids) != len(set(teacher_ids)):
            raise ValueError("Нэг багшийг орлон заасан цагт давхар оруулж болохгүй.")
        return self


VALID_UNITS = {"БАЗАН", "БУЗАН", "НУЗАН"}
VALID_ATTENDANCE = {"Ирсэн", "Хоцорсон", "Чөлөөтэй", "Өвчтэй", "Тасалсан"}
