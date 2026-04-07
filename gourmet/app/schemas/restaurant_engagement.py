from datetime import datetime

from pydantic import BaseModel, Field


class RestaurantCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class RestaurantCommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class RestaurantCommentRead(BaseModel):
    id: int
    body: str
    user_id: int
    author_nickname: str
    created_at: datetime


class RestaurantEngagementRead(BaseModel):
    like_count: int
    comment_count: int
    liked_by_me: bool
