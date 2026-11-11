from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, model_validator

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
