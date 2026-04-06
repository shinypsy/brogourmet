from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MenuItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price_krw: int
    is_main_menu: bool


class RestaurantListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    district: str
    category: str
    summary: str
    image_url: str | None
    latitude: float | None
    longitude: float | None
    main_menu_name: str
    main_menu_price: int


class RestaurantDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    district: str
    category: str
    summary: str
    image_url: str | None
    latitude: float | None
    longitude: float | None
    created_at: datetime
    menu_items: list[MenuItemRead] = Field(default_factory=list)


class RestaurantWrite(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    city: str = Field(default="서울특별시", min_length=1, max_length=100)
    district: str = Field(min_length=1, max_length=50)
    category: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=8000)
    image_url: str | None = Field(default=None, max_length=500)
    latitude: float | None = None
    longitude: float | None = None
    main_menu_name: str = Field(min_length=1, max_length=200)
    main_menu_price: int = Field(ge=0, le=10_000)
