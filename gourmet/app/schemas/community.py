from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FreeShareCategory = Literal["food", "appliance", "furniture", "books", "other"]

# BroG / MyG / 무료나눔 작성란 공통 첨부 상한
BOARD_WRITE_MAX_IMAGES = 6
_FREE_SHARE_MAX_IMAGES = BOARD_WRITE_MAX_IMAGES
_FREE_SHARE_URL_MAX = 500


class FreeSharePostBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=8000)
    district: str | None = Field(default=None, max_length=50)
    image_urls: list[str] = Field(default_factory=list, max_length=_FREE_SHARE_MAX_IMAGES)
    image_url: str | None = Field(default=None, max_length=_FREE_SHARE_URL_MAX)
    share_category: FreeShareCategory = "other"
    share_latitude: float | None = None
    share_longitude: float | None = None
    share_place_label: str | None = Field(default=None, max_length=200)

    @field_validator("image_urls", mode="before")
    @classmethod
    def _normalize_image_urls(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        out: list[str] = []
        seen: set[str] = set()
        for x in v:
            t = str(x).strip()[:_FREE_SHARE_URL_MAX]
            if t and t not in seen:
                seen.add(t)
                out.append(t)
            if len(out) >= _FREE_SHARE_MAX_IMAGES:
                break
        return out

    @model_validator(mode="after")
    def _merge_legacy_single_url(self) -> FreeSharePostBase:
        legacy = (self.image_url or "").strip()[:_FREE_SHARE_URL_MAX]
        if (
            legacy
            and legacy not in self.image_urls
            and len(self.image_urls) < _FREE_SHARE_MAX_IMAGES
        ):
            self.image_urls = [legacy, *self.image_urls]
        self.image_urls = self.image_urls[:_FREE_SHARE_MAX_IMAGES]
        return self

    @model_validator(mode="after")
    def _share_place_coords(self) -> FreeSharePostBase:
        la, lo = self.share_latitude, self.share_longitude
        if la is None and lo is None:
            self.share_place_label = None
            return self
        if la is None or lo is None:
            raise ValueError("share_latitude와 share_longitude는 함께 지정하거나 둘 다 비워야 합니다.")
        if not (-90.0 <= la <= 90.0) or not (-180.0 <= lo <= 180.0):
            raise ValueError("나눔 장소 좌표가 올바르지 않습니다.")
        label = (self.share_place_label or "").strip()
        self.share_place_label = label[:200] if label else None
        return self


class FreeSharePostCreate(FreeSharePostBase):
    """POST 새 글 — 나눔완료는 항상 미완료(클라이언트에서내도 무시)."""


class FreeSharePostUpdate(FreeSharePostBase):
    """PUT 수정 — 나눔완료 포함."""

    share_completed: bool = False


class FreeSharePostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    title: str
    body: str
    district: str | None
    image_url: str | None
    image_urls: list[str]
    share_completed: bool
    share_category: FreeShareCategory
    share_latitude: float | None = None
    share_longitude: float | None = None
    share_place_label: str | None = None
    author_nickname: str
    created_at: datetime


class FreeShareCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class FreeShareCommentRead(BaseModel):
    id: int
    body: str
    user_id: int
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
    image_urls: list[str] = Field(default_factory=list, max_length=BOARD_WRITE_MAX_IMAGES)
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
    # 작성자 역할이 franchise이면 True — 지도 깃발 구분
    is_franchise: bool = False
