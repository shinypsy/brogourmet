from datetime import datetime

from pydantic import BaseModel, Field


class SiteEventCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class SiteEventRead(BaseModel):
    id: int
    author_id: int | None
    body: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SiteEventTickerResponse(BaseModel):
    """활성 이벤트 문구를 하나의 티커 문자열로 합친 값."""

    text: str
