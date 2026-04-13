from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    # 가입 시 항상 user. super_admin 은 SUPER_ADMIN_EMAIL 등으로 별도 처리, regional_manager 는 DB에서 수동 지정.
    role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)
    # regional_manager 일 때만 사용. districts.id — SQL 로 role/managed_district_id 를 맞춰 지역 담당으로 승격.
    managed_district_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    email_verification_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Myinfo 비밀번호 변경 — 이메일로 받은 6자리 코드 검증 후 일회 사용
    password_change_code_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_change_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # BroG 최초 적립 대상 글 등록 시 가산(일반 100 · 지역 담당 200). `db_migrate`로 컬럼 보장.
    points_balance: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0"), default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    managed_district: Mapped["District | None"] = relationship(  # noqa: F821
        "District",
        foreign_keys=[managed_district_id],
    )
