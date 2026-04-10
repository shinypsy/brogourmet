from datetime import datetime

from pydantic import BaseModel, Field


class SiteEventCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)
    restaurant_id: int | None = Field(
        default=None,
        ge=1,
        description="생략·NULL: 상단 티커 전역. 지정 시 해당 BroG 메인 리스트 카드 스티커·상세 본문",
    )


class SiteEventRead(BaseModel):
    id: int
    author_id: int | None
    body: str
    is_active: bool
    created_at: datetime
    restaurant_id: int | None = None

    model_config = {"from_attributes": True}


class SiteEventTickerResponse(BaseModel):
    """활성 이벤트 문구를 하나의 티커 문자열로 합친 값."""

    text: str
