from __future__ import annotations

from pydantic import BaseModel, Field


class GameLocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class OnlinePeerOut(BaseModel):
    id: int
    nickname: str
    has_game_location: bool


class GameOnlineSummaryOut(BaseModel):
    my_location_set: bool
    my_game_lat: float | None = None
    my_game_lng: float | None = None
    online_peers: list[OnlinePeerOut]


class PeerLocationOut(BaseModel):
    id: int
    nickname: str
    lat: float
    lng: float


class CloserPeerHintOut(BaseModel):
    id: int
    nickname: str


class CloserRoundOut(BaseModel):
    peer_a: CloserPeerHintOut
    peer_b: CloserPeerHintOut


class CloserGuessIn(BaseModel):
    peer_a_id: int = Field(ge=1)
    peer_b_id: int = Field(ge=1)
    picked_user_id: int = Field(ge=1)


class CloserGuessOut(BaseModel):
    correct: bool
    closer_user_id: int
    distances_km: dict[str, float]
    markers: list[dict[str, float | int | str]]
