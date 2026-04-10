from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SiteNotice(Base):
    """홈 등 노출용 고정 슬롯 공지(1~3). 관리자만 수정."""

    __tablename__ = "site_notices"

    slot: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )
