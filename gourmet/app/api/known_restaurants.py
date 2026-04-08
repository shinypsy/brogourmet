from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deploy_stage1 import district_name_in_stage1, stage1_district_names
from app.deps import (
    ensure_community_post_author_or_moderation,
    ensure_community_post_super_admin_delete,
    get_current_user,
    get_db,
)
from app.models.district import District
from app.core.roles import FRANCHISE
from app.models.known_restaurant_post import KnownRestaurantPost
from app.models.user import User
from app.schemas.community import KnownRestaurantPostCreate, KnownRestaurantPostRead
from app.services.myg_menu_parse import parse_menu_lines_first_main

router = APIRouter(prefix="/known-restaurants", tags=["known-restaurants"])


def _trim_image_urls(raw: list[str], max_n: int = 5) -> list[str]:
    out: list[str] = []
    for u in raw:
        s = (u or "").strip()
        if s and s not in out:
            out.append(s)
        if len(out) >= max_n:
            break
    return out


def _apply_payload_to_post(db: Session, post: KnownRestaurantPost, payload: KnownRestaurantPostCreate) -> None:
    if payload.district_id is not None:
        d = (
            db.query(District)
            .filter(District.id == payload.district_id, District.active.is_(True))
            .first()
        )
        if not d:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid district_id")
        if not district_name_in_stage1(d.name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="1단계 배포에서는 선택 가능한 구만 사용할 수 있습니다.",
            )
        if not (payload.category and payload.summary and payload.menu_lines):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="BroG 형식에는 category, summary, menu_lines가 필요합니다.",
            )
        menu_lines = payload.menu_lines.strip()
        if not menu_lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="menu_lines가 비었습니다.")
        parsed = parse_menu_lines_first_main(menu_lines)
        if not parsed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='menu_lines 첫 줄을 "메뉴명 : 가격" 형식으로 입력하세요.',
            )
        imgs = _trim_image_urls(list(payload.image_urls))
        if payload.image_url and payload.image_url.strip():
            u = payload.image_url.strip()
            imgs = [u] + [x for x in imgs if x != u][:4]
        post.city = (payload.city or "서울특별시").strip()[:100]
        post.district_id = payload.district_id
        post.district = d.name.strip()
        post.category = payload.category.strip()[:80]
        post.summary = payload.summary.strip()
        post.menu_lines = menu_lines
        post.restaurant_name = payload.restaurant_name.strip()[:200]
        post.main_menu_name = parsed.name[:200]
        post.main_menu_price = parsed.price_krw
        post.title = ((payload.title or post.restaurant_name).strip())[:200]
        post.body = ((payload.body or payload.summary).strip())[:8000]
        post.latitude = payload.latitude
        post.longitude = payload.longitude
        post.image_urls = imgs if imgs else None
        post.image_url = imgs[0] if imgs else None
        return

    if not payload.district or not payload.title or not payload.body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="district, title, body가 필요합니다.",
        )
    if not district_name_in_stage1(payload.district.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="1단계 배포에서는 선택 가능한 구만 사용할 수 있습니다.",
        )
    if payload.main_menu_name is None or payload.main_menu_price is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="main_menu_name, main_menu_price가 필요합니다.",
        )
    post.restaurant_name = payload.restaurant_name.strip()[:200]
    post.district = payload.district.strip()[:50]
    post.district_id = None
    post.title = payload.title.strip()[:200]
    post.body = payload.body.strip()[:8000]
    post.main_menu_name = payload.main_menu_name.strip()[:200]
    post.main_menu_price = int(payload.main_menu_price)
    post.image_url = payload.image_url.strip()[:500] if payload.image_url else None
    post.city = (payload.city or "서울특별시").strip()[:100]
    post.category = payload.category.strip()[:80] if payload.category else None
    post.summary = payload.summary.strip() if payload.summary else None
    post.menu_lines = payload.menu_lines.strip() if payload.menu_lines else None
    post.latitude = payload.latitude
    post.longitude = payload.longitude
    imgs = _trim_image_urls(list(payload.image_urls))
    if post.image_url:
        imgs = [post.image_url] + [x for x in imgs if x != post.image_url][:4]
    post.image_urls = imgs if imgs else None


def _to_read(p: KnownRestaurantPost) -> KnownRestaurantPostRead:
    author_role = getattr(p.author, "role", None)
    return KnownRestaurantPostRead(
        id=p.id,
        author_id=p.author_id,
        title=p.title,
        body=p.body,
        restaurant_name=p.restaurant_name,
        district=p.district,
        main_menu_name=p.main_menu_name,
        main_menu_price=p.main_menu_price,
        image_url=p.image_url,
        author_nickname=p.author.nickname,
        created_at=p.created_at,
        city=p.city,
        district_id=p.district_id,
        category=p.category,
        summary=p.summary,
        latitude=p.latitude,
        longitude=p.longitude,
        image_urls=p.image_urls,
        menu_lines=p.menu_lines,
        is_franchise=author_role == FRANCHISE,
    )


@router.get("/posts", response_model=list[KnownRestaurantPostRead])
def list_posts(db: Session = Depends(get_db)):
    posts = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .order_by(KnownRestaurantPost.created_at.desc())
        .all()
    )
    allowed = stage1_district_names()
    if allowed is not None:
        posts = [p for p in posts if p.district and p.district.strip() in allowed]
    return [_to_read(p) for p in posts]


@router.get("/posts/{post_id}", response_model=KnownRestaurantPostRead)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if not district_name_in_stage1(post.district):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _to_read(post)


@router.post("/posts", response_model=KnownRestaurantPostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: KnownRestaurantPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = KnownRestaurantPost(author_id=current_user.id)
    _apply_payload_to_post(db, post, payload)
    db.add(post)
    db.commit()
    db.refresh(post)
    post = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.id == post.id)
        .first()
    )
    assert post is not None
    return _to_read(post)


@router.put("/posts/{post_id}", response_model=KnownRestaurantPostRead)
def update_post(
    post_id: int,
    payload: KnownRestaurantPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_community_post_author_or_moderation(current_user, post.author_id, post.district, db)

    _apply_payload_to_post(db, post, payload)
    db.commit()
    db.refresh(post)
    post = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.id == post_id)
        .first()
    )
    assert post is not None
    return _to_read(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(KnownRestaurantPost).filter(KnownRestaurantPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    ensure_community_post_super_admin_delete(current_user)
    db.delete(post)
    db.commit()
