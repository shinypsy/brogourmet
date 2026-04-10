from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SiteEvent(Base):
    __tablename__ = "site_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    restaurant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("restaurants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    author: Mapped["User | None"] = relationship("User", foreign_keys=[author_id])
