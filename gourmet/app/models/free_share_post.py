from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FreeSharePost(Base):
    __tablename__ = "free_share_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    district: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_urls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    share_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_category: Mapped[str] = mapped_column(String(20), default="other", nullable=False)
    share_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    share_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    share_place_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])
    comments: Mapped[list["FreeShareComment"]] = relationship(
        "FreeShareComment",
        back_populates="post",
        cascade="all, delete-orphan",
    )
