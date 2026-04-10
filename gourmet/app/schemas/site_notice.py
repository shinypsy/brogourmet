from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class SiteNoticeRead(BaseModel):
    slot: int = Field(ge=1, le=3)
    title: str
    body: str
    updated_at: datetime | None = None


class SiteNoticeItemUpdate(BaseModel):
    slot: int = Field(ge=1, le=3)
    title: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=8000)

    @field_validator("title", "body", mode="before")
    @classmethod
    def strip_str(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class SiteNoticesAdminPut(BaseModel):
    """슬롯 1·2·3 각각 한 줄씩 보내 일괄 저장."""

    items: list[SiteNoticeItemUpdate]

    @model_validator(mode="after")
    def exactly_three_slots(self) -> "SiteNoticesAdminPut":
        if len(self.items) != 3:
            raise ValueError("items must have exactly 3 entries (slots 1–3)")
        slots = sorted(x.slot for x in self.items)
        if slots != [1, 2, 3]:
            raise ValueError("must include slots 1, 2, and 3 each once")
        return self
