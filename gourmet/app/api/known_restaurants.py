from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.restaurants import (
    _brog_content_fingerprint_from_payload,
    _brog_content_fingerprint_from_restaurant,
)
from app.core.deploy_stage1 import district_name_in_stage1
from app.deps import (
    can_moderate_community_post_district,
    ensure_community_post_author_or_moderation,
    get_current_user,
    get_db,
)
from app.models.district import District
from app.core.roles import FRANCHISE
from app.models.known_restaurant_post import KnownRestaurantPost
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.community import KnownRestaurantPostCreate, KnownRestaurantPostRead
from app.services.brog_to_myg import build_known_restaurant_create_from_brog
from app.services.myg_menu_parse import parse_menu_lines_first_main
from app.services.myg_to_brog import restaurant_write_from_known_post

router = APIRouter(prefix="/known-restaurants", tags=["known-restaurants"])


def _brog_core_fingerprint_tuple(full: tuple) -> tuple:
    """이미지 URL 제외 — BroG·MyG 왕복 시 복사 경로(`/uploads/brog` vs `/uploads/myg`)만 달라도 동일 글로 본다."""
    return (full[0], full[1], full[2], full[3], full[4], full[5], full[7])


def _find_roundtrip_myg_for_brog(
    db: Session,
    user_id: int,
    restaurant: Restaurant,
) -> KnownRestaurantPost | None:
    """
    본인 MyG → BroG 등록 후 「MyG로 내려받기」 시, 이미 같은 내용의 MyG가 있으면 그 행을 반환(중복 생성 방지).
    """
    if restaurant.submitted_by_user_id is None or restaurant.submitted_by_user_id != user_id:
        return None
    want = _brog_core_fingerprint_tuple(_brog_content_fingerprint_from_restaurant(restaurant))
    posts = (
        db.query(KnownRestaurantPost)
        .filter(KnownRestaurantPost.author_id == user_id)
        .order_by(KnownRestaurantPost.created_at.desc())
        .all()
    )
    for p in posts:
        try:
            pw = restaurant_write_from_known_post(db, p)
        except ValueError:
            continue
        got = _brog_core_fingerprint_tuple(_brog_content_fingerprint_from_payload(pw))
        if got == want:
            return p
    return None


def _can_read_known_restaurant_post(
    user: User,
    post: KnownRestaurantPost,
    db: Session,
    *,
    district_for_acl: str | None = None,
) -> bool:
    """열람: 작성자 본인 또는 슈퍼·해당 구 지역담당자(MyG 개인공간이어도 운영 수정용)."""
    if user.id == post.author_id:
        return True
    dname = district_for_acl if district_for_acl is not None else post.district
    return can_moderate_community_post_district(user, dname, db)


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


def _district_id_to_name_map(db: Session, posts: list[KnownRestaurantPost]) -> dict[int, str]:
    """MyG 행의 district 문자열이 비었거나 옛값일 때 district_id로 표준 구명을 쓴다."""
    ids = {p.district_id for p in posts if p.district_id is not None}
    if not ids:
        return {}
    rows = (
        db.query(District)
        .filter(District.id.in_(ids), District.active.is_(True))
        .all()
    )
    return {r.id: (r.name or "").strip() for r in rows if (r.name or "").strip()}


def _resolved_district_name_for_post(p: KnownRestaurantPost, id_to_name: dict[int, str]) -> str:
    if p.district_id is not None:
        named = id_to_name.get(p.district_id)
        if named:
            return named
    return (p.district or "").strip()


def _to_read(p: KnownRestaurantPost, *, district_display: str | None = None) -> KnownRestaurantPostRead:
    author_role = getattr(p.author, "role", None)
    dist = district_display if district_display is not None else p.district
    return KnownRestaurantPostRead(
        id=p.id,
        author_id=p.author_id,
        title=p.title,
        body=p.body,
        restaurant_name=p.restaurant_name,
        district=dist,
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
def list_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """로그인 사용자 **본인 글**만 (MyG 개인공간)."""
    posts = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.author_id == current_user.id)
        .order_by(KnownRestaurantPost.created_at.desc())
        .all()
    )
    id_to_name = _district_id_to_name_map(db, posts)
    # 본인 MyG는 1단계 허용 구 밖 글도 항상 목록에 포함(구명은 district_id·문자열로 정규화만).
    return [
        _to_read(p, district_display=_resolved_district_name_for_post(p, id_to_name))
        for p in posts
    ]


@router.post(
    "/posts/from-brog/{restaurant_id}",
    response_model=KnownRestaurantPostRead,
    status_code=status.HTTP_201_CREATED,
)
def create_post_from_brog(
    restaurant_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    공개 BroG 매장·메뉴·사진 URL·요약을 그대로 반영한 MyG 글을 현재 사용자 명의로 생성.
    로그인한 사용자면 누구나 (1단계 허용 구의 BroG만).
    본인이 MyG에서 올린 BroG라 이미 동일 내용 MyG가 있으면 새로 만들지 않고 그 글을 돌려준다.

    저장소 분리: 경로의 `restaurant_id`는 `restaurants`(BroG) PK. 생성·반환되는 MyG `id`는
    `known_restaurant_posts` PK로 **독립**이다(숫자가 같아도 다른 행·우연일 뿐).
    이 엔드포인트는 BroG 행을 삭제·수정하지 않는다.
    """
    r = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            joinedload(Restaurant.district),
        )
        .filter(
            Restaurant.id == restaurant_id,
            Restaurant.is_deleted.is_(False),
            Restaurant.status == "published",
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    dname = (r.district.name if r.district else "").strip()
    if not district_name_in_stage1(dname):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="1단계에서 허용되지 않은 구의 BroG는 MyG로 가져올 수 없습니다.",
        )
    existing = _find_roundtrip_myg_for_brog(db, current_user.id, r)
    if existing is not None and district_name_in_stage1(existing.district):
        post = (
            db.query(KnownRestaurantPost)
            .options(joinedload(KnownRestaurantPost.author))
            .filter(KnownRestaurantPost.id == existing.id)
            .first()
        )
        if post is not None:
            response.status_code = status.HTTP_200_OK
            # 기존 행은 예전에 절대 URL·복사 실패 등으로 image_urls가 깨져 있을 수 있음 → 현재 BroG 기준으로 다시 채움
            fresh = build_known_restaurant_create_from_brog(r)
            imgs = _trim_image_urls(list(fresh.image_urls or []))
            if fresh.image_url and str(fresh.image_url).strip():
                u = str(fresh.image_url).strip()
                imgs = [u] + [x for x in imgs if x != u][:4]
            post.image_urls = imgs if imgs else None
            post.image_url = imgs[0] if imgs else None
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

    payload = build_known_restaurant_create_from_brog(r)
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


@router.get("/posts/{post_id}", response_model=KnownRestaurantPostRead)
def get_post(
    post_id: int,
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
    id_to_name = _district_id_to_name_map(db, [post])
    rd = _resolved_district_name_for_post(post, id_to_name)
    if not _can_read_known_restaurant_post(current_user, post, db, district_for_acl=rd):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _to_read(post, district_display=rd)


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
    """
    MyG(`known_restaurant_posts`)만 삭제. BroG(`restaurants`)와 저장소·PK가 다르며,
    `post_id`는 MyG 테이블 id만 가리킨다 — 동일 숫자의 BroG 매장은 건드리지 않는다.
    """
    post = db.query(KnownRestaurantPost).filter(KnownRestaurantPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    ensure_community_post_author_or_moderation(current_user, post.author_id, post.district, db)
    db.delete(post)
    db.commit()
