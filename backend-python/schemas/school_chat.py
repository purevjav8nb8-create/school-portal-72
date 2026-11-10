from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints


ChatBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
ChatUnit = Literal["БАЗАН", "БУЗАН", "НУЗАН"]


class ChatMessageCreate(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=255)
    body: ChatBody
    target_units: list[ChatUnit] = Field(default_factory=list)


class ChatReadRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=255)
