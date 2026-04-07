from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FreeSharePostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=8000)
    district: str | None = Field(default=None, max_length=50)
    image_url: str | None = Field(default=None, max_length=500)


class FreeSharePostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    title: str
    body: str
    district: str | None
    image_url: str | None
    author_nickname: str
    created_at: datetime


# MyG(known-restaurants): 개인 일기 성격 — BroG의 만원 규칙과 무관. DB Integer 상한만 둠.
_KNOWN_PRICE_MAX = 2_147_483_647


class KnownRestaurantPostCreate(BaseModel):
    """BroG 형식: district_id + category + summary + menu_lines (+ image_urls). 레거시: title/body/district 문자열."""

    restaurant_name: str = Field(min_length=1, max_length=200)
    district_id: int | None = Field(default=None, ge=1)
    city: str = Field(default="서울특별시", max_length=100)
    category: str | None = Field(default=None, max_length=80)
    summary: str | None = Field(default=None, max_length=8000)
    menu_lines: str | None = Field(default=None, max_length=20000)
    latitude: float | None = None
    longitude: float | None = None
    image_urls: list[str] = Field(default_factory=list, max_length=5)
    # 레거시(구 API·구 클라이언트)
    title: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, max_length=8000)
    district: str | None = Field(default=None, max_length=50)
    main_menu_name: str | None = Field(default=None, max_length=200)
    main_menu_price: int | None = Field(default=None, ge=0, le=_KNOWN_PRICE_MAX)
    image_url: str | None = Field(default=None, max_length=500)


class KnownRestaurantPostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    title: str
    body: str
    restaurant_name: str
    district: str
    main_menu_name: str
    main_menu_price: int
    image_url: str | None
    author_nickname: str
    created_at: datetime
    city: str | None = None
    district_id: int | None = None
    category: str | None = None
    summary: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    image_urls: list[str] | None = None
    menu_lines: str | None = None
