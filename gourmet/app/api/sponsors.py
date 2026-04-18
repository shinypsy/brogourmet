from __future__ import annotations

import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.deps import get_db, get_super_admin_user
from app.geo_utils import haversine_m
from app.models.sponsor_post import SponsorPost
from app.models.user import User
from app.schemas.sponsor import SPONSOR_MAX_IMAGES, SponsorPostCreate, SponsorPostRead, SponsorPostUpdate

router = APIRouter(prefix="/sponsors", tags=["sponsors"])


def _normalize_urls(raw: list | None) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for u in raw:
        t = str(u).strip()[:500]
        if t and t not in seen:
            seen.add(t)
            out.append(t)
        if len(out) >= SPONSOR_MAX_IMAGES:
            break
    return out


def _to_read(post: SponsorPost) -> SponsorPostRead:
    nick = (post.author.nickname or "").strip() if post.author else ""
    return SponsorPostRead(
        id=post.id,
        author_id=post.author_id,
        title=post.title,
        excerpt=post.excerpt or "",
        body=post.body,
        accent=post.accent or "#4a5568",
        image_urls=_normalize_urls(post.image_urls),
        external_url=(post.external_url or "").strip() or None,
        latitude=post.latitude,
        longitude=post.longitude,
        author_nickname=nick,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _post_or_404(db: Session, post_id: int) -> SponsorPost:
    post = (
        db.query(SponsorPost)
        .options(joinedload(SponsorPost.author))
        .filter(SponsorPost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="스폰서 글을 찾을 수 없습니다.")
    return post


@router.get("/posts", response_model=list[SponsorPostRead])
def list_sponsor_posts(
    q: str = "",
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[SponsorPostRead]:
    rows = (
        db.query(SponsorPost)
        .options(joinedload(SponsorPost.author))
        .order_by(SponsorPost.created_at.desc())
        .all()
    )
    qt = q.strip().lower()
    filtered = rows
    if qt:
        filtered = [
            p
            for p in rows
            if qt in p.title.lower()
            or qt in (p.excerpt or "").lower()
            or qt in p.body.lower()
        ]
    sort_lat = lat
    sort_lng = lng
    if (
        sort_lat is None
        or sort_lng is None
        or not math.isfinite(sort_lat)
        or not math.isfinite(sort_lng)
        or sort_lat < -90
        or sort_lat > 90
        or sort_lng < -180
        or sort_lng > 180
    ):
        return [_to_read(p) for p in filtered]

    def dist_key(p: SponsorPost) -> float:
        la, lo = p.latitude, p.longitude
        if la is None or lo is None or not math.isfinite(la) or not math.isfinite(lo):
            return float("inf")
        return haversine_m(sort_lat, sort_lng, la, lo)

    ordered = sorted(filtered, key=dist_key)
    return [_to_read(p) for p in ordered]


@router.get("/posts/{post_id}", response_model=SponsorPostRead)
def get_sponsor_post(post_id: int, db: Session = Depends(get_db)) -> SponsorPostRead:
    return _to_read(_post_or_404(db, post_id))


@router.post("/posts", response_model=SponsorPostRead, status_code=status.HTTP_201_CREATED)
def create_sponsor_post(
    payload: SponsorPostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_super_admin_user),
) -> SponsorPostRead:
    la, lo = payload.latitude, payload.longitude
    if (la is None) != (lo is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="위도와 경도는 둘 다 보내거나 둘 다 비워야 합니다.",
        )
    urls = _normalize_urls(payload.image_urls)
    post = SponsorPost(
        author_id=user.id,
        title=payload.title.strip(),
        excerpt=(payload.excerpt or "").strip()[:300],
        body=payload.body.strip(),
        accent=(payload.accent or "#4a5568").strip()[:32] or "#4a5568",
        image_urls=urls if urls else None,
        external_url=(payload.external_url or "").strip()[:800] or None,
        latitude=la,
        longitude=lo,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    post = _post_or_404(db, post.id)
    return _to_read(post)


@router.patch("/posts/{post_id}", response_model=SponsorPostRead)
def update_sponsor_post(
    post_id: int,
    payload: SponsorPostUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_super_admin_user),
) -> SponsorPostRead:
    post = _post_or_404(db, post_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        post.title = str(data["title"]).strip()
    if "excerpt" in data:
        post.excerpt = str(data["excerpt"] or "").strip()[:300]
    if "body" in data:
        post.body = str(data["body"]).strip()
    if "accent" in data:
        post.accent = (str(data["accent"] or "").strip()[:32] or "#4a5568")
    if "image_urls" in data:
        urls = _normalize_urls(data["image_urls"])
        post.image_urls = urls if urls else None
    if "external_url" in data:
        raw = data["external_url"]
        post.external_url = (str(raw).strip()[:800] if raw is not None else "") or None
    if "latitude" in data or "longitude" in data:
        la = data["latitude"] if "latitude" in data else post.latitude
        lo = data["longitude"] if "longitude" in data else post.longitude
        if (la is None) != (lo is None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="위도와 경도는 둘 다 보내거나 둘 다 비워야 합니다.",
            )
        post.latitude = la
        post.longitude = lo
    db.add(post)
    db.commit()
    db.refresh(post)
    post = _post_or_404(db, post.id)
    return _to_read(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sponsor_post(
    post_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_super_admin_user),
) -> None:
    post = _post_or_404(db, post_id)
    db.delete(post)
    db.commit()
