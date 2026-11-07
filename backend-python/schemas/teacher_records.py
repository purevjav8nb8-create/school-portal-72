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
    target_units: list[Literal["БАЗАН", "БУЗАН", "НУЗАН"]] = Field(default_factory=list)
    kind: Literal["Мэдээлэл", "Зар"] = "Зар"
    info_type: Literal["Амжилт", "Оролцоо"] | None = None

    @field_validator("title", "body")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Энэ талбар хоосон байж болохгүй.")
        return value


class SurveyQuestion(BaseModel):
    text: str = Field(min_length=1)
    type: Literal["single_choice", "multiple_choice", "short_text", "rating"] = "single_choice"
    options: list[str] = Field(default_factory=list)

    @field_validator("text")
    @classmethod
    def trim_question(cls, value: str) -> str:
        return value.strip()

    @field_validator("options")
    @classmethod
    def trim_options(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]

    @model_validator(mode="after")
    def validate_question_options(self):
        if self.type in {"single_choice", "multiple_choice"} and len(self.options) < 2:
            raise ValueError("Сонголтот асуулт бүр дор хаяж 2 сонголттой байна.")
        if self.type not in {"single_choice", "multiple_choice"}:
            self.options = []
        return self


class SurveyCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    questions: list[SurveyQuestion] = Field(min_length=1)
    target_units: list[Literal["БАЗАН", "БУЗАН", "НУЗАН"]] = Field(default_factory=list)

    @field_validator("title", "description")
    @classmethod
    def trim_survey_text(cls, value: str) -> str:
        return value.strip()

class SurveyResponseCreate(BaseModel):
    question_index: int = Field(default=0, ge=0)
    option: str | list[str]

    @field_validator("option")
    @classmethod
    def validate_answer(cls, value: str | list[str]) -> str | list[str]:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Хариулт хоосон байж болохгүй.")
            return value
        answers = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not answers:
            raise ValueError("Дор хаяж нэг сонголт хийнэ үү.")
        return answers


class SurveySubmissionCreate(BaseModel):
    answers: list[SurveyResponseCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def require_unique_questions(self):
        indexes = [answer.question_index for answer in self.answers]
        if len(indexes) != len(set(indexes)):
            raise ValueError("Асуулт бүрт нэг хариулт өгнө үү.")
        return self


class AwardCreate(BaseModel):
    name: str = Field(min_length=1)
    certificate_number: str = ""
    certificate_url: str = ""
    organization: str = ""
    status: Literal["Одоо байгаа шагнал", "Хүсэлт"] = "Одоо байгаа шагнал"
    application_url: str = ""
    meeting_minutes_url: str = ""
    reference_url: str = ""
    justification: str = ""
    awarded_date: date | None = None
    note: str = ""

    @model_validator(mode="after")
    def validate_award_submission(self):
        if self.status == "Одоо байгаа шагнал" and (
            not self.certificate_number.strip() or not self.certificate_url.strip() or not self.organization.strip()
        ):
            raise ValueError("Шагнал бүртгэхэд үнэмлэхний дугаар, PDF болон олгосон байгууллага шаардлагатай.")
        if self.status == "Хүсэлт":
            self.certificate_number = ""
            self.certificate_url = ""
            self.organization = ""
            self.awarded_date = None
            self.justification = self.justification.strip()
            if not all((self.application_url.strip(), self.meeting_minutes_url.strip(), self.reference_url.strip(), self.justification)):
                raise ValueError("Шагналын хүсэлтэд анкет, хурлын протокол, тодорхойлолтын PDF болон шагнуулах үндэслэл шаардлагатай.")
        else:
            self.application_url = ""
            self.meeting_minutes_url = ""
            self.reference_url = ""
            self.justification = ""
        return self


class ProfessionalDegreeCreate(BaseModel):
    name: str = Field(min_length=1)
    certificate_number: str = ""
    certificate_url: str = ""
    status: Literal["Одоо байгаа зэрэг", "Хүсэлт"] = "Одоо байгаа зэрэг"
    issued_date: date | None = None
    note: str = ""

    @model_validator(mode="after")
    def validate_degree_submission(self):
        if self.name not in {"Заах аргач", "Тэргүүлэх", "Зөвлөх"}:
            raise ValueError("Мэргэжлийн зэргийн сонголт буруу байна.")
        if self.status == "Одоо байгаа зэрэг" and (not self.certificate_number.strip() or not self.certificate_url.strip()):
            raise ValueError("Одоо байгаа зэргээ бүртгэхэд үнэмлэхний дугаар болон PDF шаардлагатай.")
        if self.status == "Хүсэлт":
            self.certificate_number = ""
            self.certificate_url = ""
            self.issued_date = None
        return self
