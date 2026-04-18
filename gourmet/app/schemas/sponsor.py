from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

SPONSOR_MAX_IMAGES = 4


class SponsorPostRead(BaseModel):
    id: int
    author_id: int
    title: str
    excerpt: str
    body: str
    accent: str
    image_urls: list[str]
    external_url: str | None
    latitude: float | None
    longitude: float | None
    author_nickname: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SponsorPostCreate(BaseModel):
    title: str = Field(..., max_length=200)
    excerpt: str = Field(default="", max_length=300)
    body: str
    accent: str = Field(default="#4a5568", max_length=32)
    image_urls: list[str] = Field(default_factory=list)
    external_url: str | None = Field(default=None, max_length=800)
    latitude: float | None = None
    longitude: float | None = None


class SponsorPostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    excerpt: str | None = Field(default=None, max_length=300)
    body: str | None = None
    accent: str | None = Field(default=None, max_length=32)
    image_urls: list[str] | None = None
    external_url: str | None = Field(default=None, max_length=800)
    latitude: float | None = None
    longitude: float | None = None
