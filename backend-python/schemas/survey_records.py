from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator

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
    starts_at: datetime
    ends_at: datetime

    @field_validator("title", "description")
    @classmethod
    def trim_survey_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_survey_window(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("Судалгааны дуусах хугацаа эхлэх хугацаанаас хойш байна.")
        return self

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
