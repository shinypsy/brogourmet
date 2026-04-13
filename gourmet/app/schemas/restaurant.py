from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

BroGCategory = Literal["한식", "중식", "일식", "양식", "분식", "패스트푸드", "음료"]


class MenuItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price_krw: int
    is_main_menu: bool
    card_slot: int | None = None


class RestaurantListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    district_id: int
    district: str
    category: str
    summary: str
    image_url: str | None
    image_urls: list[str] = Field(default_factory=list)
    latitude: float | None
    longitude: float | None
    main_menu_name: str
    main_menu_price: int
    # 동일 위치 중복 매장 중 첫 등록(이름(원조!!!)·레거시 이름_* 등)만 True — 목록에서 굵은 제목 표시용
    points_eligible: bool = True
    # 등록 계정이 가맹 역할이면 True — 지도 깃발(청록) 구분용
    is_franchise: bool = False
    # 목록·지도에서 본인 글 숨김 등 UI 판별용 (없으면 레거시 데이터)
    submitted_by_user_id: int | None = None
    submitted_by_nickname: str | None = None
    # BroG 리스트 1~4위 관리자 고정 슬롯, 없으면 좋아요 순
    bro_list_pin: int | None = None
    # 가맹점 연동 활성 이벤트 — 메인 리스트·지도 옆 목록 등 카드 사진에 스티커
    has_active_site_event: bool = False


class BroListPinState(BaseModel):
    bro_list_pin: int | None = Field(
        default=None,
        description="1~4 고정 슬롯, None이면 미고정",
    )


class RestaurantDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    district_id: int
    district: str
    category: str
    summary: str
    image_url: str | None
    image_urls: list[str] = Field(default_factory=list)
    points_eligible: bool = True
    latitude: float | None
    longitude: float | None
    status: str
    is_deleted: bool = False
    created_at: datetime
    menu_items: list[MenuItemRead] = Field(default_factory=list)
    # BroG 최초 등록자(회원·지역담당자·관리자) — 포인트 정산·표시용
    submitted_by_user_id: int | None = None
    submitted_by_nickname: str | None = None
    submitted_by_role: str | None = None
    is_franchise: bool = False
    has_active_site_event: bool = Field(
        default=False,
        description="활성 가맹점 연동 이벤트 여부(목록 카드 스티커·상세 API 일관용)",
    )
    active_site_event_bodies: list[str] = Field(
        default_factory=list,
        description="이 음식점에 연결된 활성 이벤트 본문(최신순). 상단 티커 전역 이벤트와 별개",
    )


class ExtraCardMenuWrite(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price_krw: int = Field(ge=0, le=1_000_000)


class RestaurantWrite(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    city: str = Field(default="서울특별시", min_length=1, max_length=100)
    district_id: int = Field(ge=1)
    category: BroGCategory
    summary: str = Field(min_length=1, max_length=8000)
    image_url: str | None = Field(default=None, max_length=500)
    # BroG 사진 URL 최대 6개. 비우면 image_url만 사용(하위 호환).
    image_urls: list[str] = Field(default_factory=list, max_length=6)
    latitude: float | None = None
    longitude: float | None = None
    main_menu_name: str = Field(min_length=1, max_length=200)
    main_menu_price: int = Field(ge=0, le=10_000)
    extra_card_menus: list[ExtraCardMenuWrite] = Field(default_factory=list, max_length=3)
    # 카드에 안 올라가는 부메뉴 (텍스트 목록 5~10줄 등). 최대 6.
    more_menu_items: list[ExtraCardMenuWrite] = Field(default_factory=list, max_length=6)
    status: Literal["draft", "published"] = "published"

    @field_validator("image_urls", mode="before")
    @classmethod
    def normalize_image_urls(cls, v: object) -> list[str]:
        if not v:
            return []
        if not isinstance(v, list):
            return []
        out: list[str] = []
        for x in v:
            s = str(x).strip()
            if s:
                out.append(s[:500])
        return out[:6]


class RestaurantManageRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    district_id: int
    district: str
    status: str
    is_deleted: bool = False
    updated_at: datetime
