from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), default="서울특별시", nullable=False)
    district_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("districts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # BroG 사진 URL 최대 6개 (JSON 배열). 대표 썸네일은 image_url 또는 image_urls[0]
    image_urls: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # 동일 장소·동일 브랜드로 나뉜 매장 중 첫 등록(이름 …(원조!!!) 또는 레거시 …_*)만 포인트 적립 대상
    points_eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # BroG 목록 상단 1~4위 고정(구별). NULL = 미고정, 좋아요 순 본문 정렬
    bro_list_pin: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    # NULL = 등록자 역할(franchise)에 따름 · True/False = 관리자가 지도 가맹 깃발 표시 강제
    franchise_pin: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="published", nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    district: Mapped["District"] = relationship("District", back_populates="restaurants")
    submitter: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[submitted_by_user_id],
    )
    menu_items: Mapped[list["RestaurantMenuItem"]] = relationship(
        "RestaurantMenuItem",
        back_populates="restaurant",
        cascade="all, delete-orphan",
    )
    comments: Mapped[list["RestaurantComment"]] = relationship(
        "RestaurantComment",
        back_populates="restaurant",
        cascade="all, delete-orphan",
    )
    likes: Mapped[list["RestaurantLike"]] = relationship(
        "RestaurantLike",
        back_populates="restaurant",
        cascade="all, delete-orphan",
    )


class RestaurantMenuItem(Base):
    __tablename__ = "restaurant_menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price_krw: Mapped[int] = mapped_column(Integer, nullable=False)
    is_main_menu: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 카드 티저 슬롯: 1=대표(주메뉴), 2~4=추가 강조(최대 3). NULL=카드 미노출 부메뉴
    card_slot: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="menu_items")
