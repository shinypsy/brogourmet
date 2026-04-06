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
    title: str
    body: str
    district: str | None
    image_url: str | None
    author_nickname: str
    created_at: datetime


class KnownRestaurantPostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=8000)
    restaurant_name: str = Field(min_length=1, max_length=200)
    district: str = Field(min_length=1, max_length=50)
    main_menu_name: str = Field(min_length=1, max_length=200)
    main_menu_price: int = Field(ge=0, le=10_000)
    image_url: str | None = Field(default=None, max_length=500)


class KnownRestaurantPostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    restaurant_name: str
    district: str
    main_menu_name: str
    main_menu_price: int
    image_url: str | None
    author_nickname: str
    created_at: datetime
