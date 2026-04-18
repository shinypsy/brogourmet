"""친구찾기(거리 맞추기) 테스트용 — 접속(last_seen)·게임 좌표 기반."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.game_social import (
    CloserGuessIn,
    CloserGuessOut,
    CloserPeerHintOut,
    CloserRoundOut,
    GameLocationIn,
    GameOnlineSummaryOut,
    OnlinePeerOut,
    PeerLocationOut,
)

router = APIRouter(prefix="/game", tags=["game"])

# 테스트용: 최근 N초 이내 하트비트를 "접속 중"으로 간주
ONLINE_WINDOW_SEC = 120
RADIUS_KM = 5.0


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


@router.post("/presence", status_code=status.HTTP_204_NO_CONTENT)
def post_presence(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.last_seen_at = utc_now()
    db.add(current_user)
    db.commit()
    return None


@router.post("/location", status_code=status.HTTP_204_NO_CONTENT)
def post_game_location(
    body: GameLocationIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.game_lat = body.lat
    current_user.game_lng = body.lng
    current_user.last_seen_at = utc_now()
    db.add(current_user)
    db.commit()
    return None


@router.get("/online-summary", response_model=GameOnlineSummaryOut)
def get_online_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    window = utc_now() - timedelta(seconds=ONLINE_WINDOW_SEC)
    others = (
        db.query(User)
        .filter(User.id != current_user.id, User.is_active.is_(True))
        .filter(User.last_seen_at.isnot(None))
        .filter(User.last_seen_at >= window)
        .order_by(User.nickname.asc())
        .all()
    )
    peers = [
        OnlinePeerOut(
            id=u.id,
            nickname=u.nickname,
            has_game_location=u.game_lat is not None and u.game_lng is not None,
        )
        for u in others
    ]
    my_loc = current_user.game_lat is not None and current_user.game_lng is not None
    my_lat = float(current_user.game_lat) if current_user.game_lat is not None else None
    my_lng = float(current_user.game_lng) if current_user.game_lng is not None else None
    return GameOnlineSummaryOut(
        my_location_set=my_loc,
        my_game_lat=my_lat,
        my_game_lng=my_lng,
        online_peers=peers,
    )


@router.get("/peer-location/{peer_id}", response_model=PeerLocationOut)
def get_peer_location(
    peer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """접속 중·게임 좌표가 있는 상대 1명 위치(내 좌표가 있으면 5km 이내만)."""
    if peer_id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신은 제외됩니다.")
    window = utc_now() - timedelta(seconds=ONLINE_WINDOW_SEC)
    peer = db.query(User).filter(User.id == peer_id, User.is_active.is_(True)).first()
    if peer is None:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    if peer.last_seen_at is None or peer.last_seen_at < window:
        raise HTTPException(status_code=400, detail="접속 중이 아닙니다.")
    if peer.game_lat is None or peer.game_lng is None:
        raise HTTPException(status_code=400, detail="상대가 게임 위치를 등록하지 않았습니다.")
    if current_user.game_lat is not None and current_user.game_lng is not None:
        d = haversine_km(
            float(current_user.game_lat),
            float(current_user.game_lng),
            float(peer.game_lat),
            float(peer.game_lng),
        )
        if d > RADIUS_KM:
            raise HTTPException(status_code=400, detail=f"반경 {int(RADIUS_KM)}km 밖에 있습니다.")
    return PeerLocationOut(
        id=peer.id,
        nickname=peer.nickname,
        lat=float(peer.game_lat),
        lng=float(peer.game_lng),
    )


@router.get("/closer-round", response_model=CloserRoundOut)
def get_closer_round(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.game_lat is None or current_user.game_lng is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="게임용 위치를 먼저 등록해 주세요. (위치 등록 버튼)",
        )
    window = utc_now() - timedelta(seconds=ONLINE_WINDOW_SEC)
    me_lat, me_lng = float(current_user.game_lat), float(current_user.game_lng)
    others = (
        db.query(User)
        .filter(User.id != current_user.id, User.is_active.is_(True))
        .filter(User.last_seen_at.isnot(None), User.last_seen_at >= window)
        .filter(User.game_lat.isnot(None), User.game_lng.isnot(None))
        .all()
    )
    in_radius: list[tuple[User, float]] = []
    for u in others:
        d = haversine_km(me_lat, me_lng, float(u.game_lat or 0), float(u.game_lng or 0))
        if d <= RADIUS_KM:
            in_radius.append((u, d))
    if len(in_radius) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"반경 {int(RADIUS_KM)}km 이내·접속 중·위치 등록된 다른 회원이 2명 이상 필요합니다. "
                f"(현재 {len(in_radius)}명)"
            ),
        )
    in_radius.sort(key=lambda x: x[1])
    pick = [in_radius[0][0], in_radius[1][0]]
    return CloserRoundOut(
        peer_a=CloserPeerHintOut(id=pick[0].id, nickname=pick[0].nickname),
        peer_b=CloserPeerHintOut(id=pick[1].id, nickname=pick[1].nickname),
    )


@router.post("/closer-guess", response_model=CloserGuessOut)
def post_closer_guess(
    body: CloserGuessIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.peer_a_id == body.peer_b_id:
        raise HTTPException(status_code=400, detail="서로 다른 두 명을 선택해야 합니다.")
    if body.picked_user_id not in (body.peer_a_id, body.peer_b_id):
        raise HTTPException(status_code=400, detail="선택은 두 후보 중 한 명만 가능합니다.")
    if current_user.game_lat is None or current_user.game_lng is None:
        raise HTTPException(status_code=400, detail="내 게임 위치가 없습니다.")

    window = utc_now() - timedelta(seconds=ONLINE_WINDOW_SEC)
    me_lat, me_lng = float(current_user.game_lat), float(current_user.game_lng)

    def load_peer(uid: int) -> User | None:
        u = db.query(User).filter(User.id == uid).first()
        if u is None or u.id == current_user.id or not u.is_active:
            return None
        if u.last_seen_at is None or u.last_seen_at < window:
            return None
        if u.game_lat is None or u.game_lng is None:
            return None
        return u

    ua = load_peer(body.peer_a_id)
    ub = load_peer(body.peer_b_id)
    if ua is None or ub is None:
        raise HTTPException(status_code=400, detail="후보 정보가 유효하지 않습니다. 라운드를 새로 받아 주세요.")

    dist_a = haversine_km(me_lat, me_lng, float(ua.game_lat), float(ua.game_lng))
    dist_b = haversine_km(me_lat, me_lng, float(ub.game_lat), float(ub.game_lng))
    if dist_a > RADIUS_KM or dist_b > RADIUS_KM:
        raise HTTPException(status_code=400, detail="후보가 반경 밖입니다.")

    closer_id = ua.id if dist_a <= dist_b else ub.id
    correct = body.picked_user_id == closer_id
    distances = {str(ua.id): round(dist_a, 3), str(ub.id): round(dist_b, 3)}
    markers = [
        {
            "id": current_user.id,
            "nickname": "나",
            "lat": me_lat,
            "lng": me_lng,
            "kind": "me",
        },
        {
            "id": ua.id,
            "nickname": ua.nickname,
            "lat": float(ua.game_lat),
            "lng": float(ua.game_lng),
            "kind": "peer",
        },
        {
            "id": ub.id,
            "nickname": ub.nickname,
            "lat": float(ub.game_lat),
            "lng": float(ub.game_lng),
            "kind": "peer",
        },
    ]
    return CloserGuessOut(
        correct=correct,
        closer_user_id=closer_id,
        distances_km=distances,
        markers=markers,
    )
