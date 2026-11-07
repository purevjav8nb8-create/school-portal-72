from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ActivityCategory = Literal[
    "Хичээлд суусан",
    "Уралдаан, тэмцээн",
    "Сургалт, семинар",
    "Хурал, зөвлөгөөн",
    "Амжилт",
]


class AnnouncementAttachment(BaseModel):
    name: str = Field(min_length=1)
    url: str = Field(min_length=1)
    file_type: Literal["image", "document"]

    @field_validator("name", "url")
    @classmethod
    def reject_blank_attachment_fields(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Хавсралтын мэдээлэл дутуу байна.")
        return value


class ActivityCreate(BaseModel):
    category: ActivityCategory
    title: str = ""
    date: date
    note: str = ""
    images: list[str] = Field(default_factory=list)
    attachments: list[AnnouncementAttachment] = Field(default_factory=list)
    grade: int | None = Field(default=None, ge=1, le=12)
    section: str | None = None
    subject: str | None = None

    @field_validator("title", "section", "subject")
    @classmethod
    def trim_optional_fields(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("note")
    @classmethod
    def trim_note(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_lesson_class(self):
        if self.category == "Хичээлд суусан":
            if not self.grade or not self.section or not self.subject:
                raise ValueError("Хичээлийн анги, бүлэг, хичээлийг сонгоно уу.")
            if not self.title:
                self.title = self.subject
        elif not self.title:
            raise ValueError("Гарчиг хоосон байж болохгүй.")
        return self


class ProgramPlanSubmit(BaseModel):
    documentUrl: str = Field(min_length=1)
    grade: int = Field(ge=1, le=12)
    section: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    note: str = ""

    @field_validator("documentUrl")
    @classmethod
    def require_document(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Хөтөлбөр, төлөвлөгөөний файл шаардлагатай.")
        return value

    @field_validator("note")
    @classmethod
    def trim_note(cls, value: str) -> str:
        return value.strip()


class ProgramPlanReview(BaseModel):
    approved: bool


class EvaluationCreate(BaseModel):
    grade: int = Field(ge=1, le=12)
    section: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    level: Literal["VIII", "VII", "VI", "V", "IV", "III", "II", "I"]
    students_count: int = Field(ge=1)
    average_score: float = Field(ge=0, le=100)
    evaluation_date: date

    @field_validator("section", "subject")
    @classmethod
    def require_nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Анги, хичээл хоосон байж болохгүй.")
        return value


class ActivityReview(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: str = ""

    @field_validator("admin_note")
    @classmethod
    def trim_note(cls, value: str) -> str:
        return value.strip()


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1)
    body: str = Field(min_length=1)
    attachments: list[AnnouncementAttachment] = Field(default_factory=list)

    @field_validator("title", "body")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Энэ талбар хоосон байж болохгүй.")
        return value
