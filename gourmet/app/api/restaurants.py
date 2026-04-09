import json
import math
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.deploy_stage1 import district_name_in_stage1, stage1_district_names
from app.core.roles import FRANCHISE, REGIONAL_MANAGER, SUPER_ADMIN
from app.deps import (
    ensure_brog_district_access,
    ensure_can_access_brog_manage,
    ensure_can_create_brog_in_chosen_district,
    get_current_user,
    get_db,
    get_super_admin_user,
)
from app.models.district import District
from app.models.known_restaurant_post import KnownRestaurantPost
from app.models.restaurant import Restaurant, RestaurantMenuItem
from app.models.restaurant_social import RestaurantLike
from app.models.user import User
from app.geo_utils import haversine_m
from app.services.myg_to_brog import restaurant_write_from_known_post
from app.schemas.restaurant import (
    BroListPinState,
    MenuItemRead,
    RestaurantDetailRead,
    RestaurantListItem,
    RestaurantManageRow,
    RestaurantWrite,
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

MAX_MAIN_MENU_KRW = 10_000
MAX_RESTAURANT_IMAGES = 5
# 위도·경도 각각 이 차이 이하면 같은 매장 좌표로 본다 (~수십 m)
SAME_PLACE_LATLON_EPS = 0.00028


def restaurant_name_base(name: str) -> str:
    """표시용 접미사(_*, _1, _2)를 제거한 브랜드 키."""
    t = (name or "").strip()
    if len(t) >= 2 and t.endswith("_*"):
        return t[:-2]
    m = re.match(r"^(.+)_(\d+)$", t)
    if m:
        return m.group(1)
    return t


def _same_restaurant_coordinates(
    lat1: float | None,
    lon1: float | None,
    lat2: float | None,
    lon2: float | None,
) -> bool:
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return False
    return abs(lat1 - lat2) <= SAME_PLACE_LATLON_EPS and abs(lon1 - lon2) <= SAME_PLACE_LATLON_EPS


def find_same_place_name_peers(
    db: Session,
    district_id: int,
    lat: float | None,
    lon: float | None,
    name_base: str,
) -> list[Restaurant]:
    if lat is None or lon is None:
        return []
    q = (
        db.query(Restaurant)
        .filter(Restaurant.district_id == district_id)
        .filter(Restaurant.is_deleted.is_(False))
    )
    peers: list[Restaurant] = []
    for r in q.all():
        if restaurant_name_base(r.name) != name_base:
            continue
        if _same_restaurant_coordinates(lat, lon, r.latitude, r.longitude):
            peers.append(r)
    return peers


def apply_duplicate_restaurant_names_for_new(db: Session, restaurant: Restaurant, submitted_name: str) -> None:
    """동일 구·근접 좌표·동일 베이스 이름이 2건 이상이면 등록순으로 …_*, …_1, …_2. 첫 건만 포인트 적립."""
    base = restaurant_name_base(submitted_name.strip())
    lat, lon = restaurant.latitude, restaurant.longitude
    if lat is None or lon is None:
        restaurant.points_eligible = True
        return
    group = find_same_place_name_peers(db, restaurant.district_id, lat, lon, base)
    if len(group) < 2:
        restaurant.points_eligible = True
        return
    group_sorted = sorted(group, key=lambda r: (r.created_at, r.id))
    for i, r in enumerate(group_sorted):
        suffix = "_*" if i == 0 else f"_{i}"
        max_base_len = 200 - len(suffix)
        b = base if len(base) <= max_base_len else base[:max_base_len]
        r.name = f"{b}{suffix}"
        r.points_eligible = i == 0


def coerce_restaurant_image_urls(payload: RestaurantWrite) -> list[str]:
    raw: list[str] = []
    for u in payload.image_urls:
        t = (u or "").strip()[:500]
        if t:
            raw.append(t)
    if not raw and payload.image_url and payload.image_url.strip():
        raw.append(payload.image_url.strip()[:500])
    seen: set[str] = set()
    out: list[str] = []
    for u in raw:
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= MAX_RESTAURANT_IMAGES:
            break
    return out


def _restaurant_image_urls_list(restaurant: Restaurant) -> list[str]:
    raw = restaurant.image_urls
    urls: list[str] = []
    if isinstance(raw, list):
        for u in raw:
            if isinstance(u, str) and u.strip():
                urls.append(u.strip()[:500])
    elif isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                for u in parsed:
                    if isinstance(u, str) and u.strip():
                        urls.append(u.strip()[:500])
        except json.JSONDecodeError:
            pass
    if not urls and restaurant.image_url and restaurant.image_url.strip():
        urls = [restaurant.image_url.strip()]
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= MAX_RESTAURANT_IMAGES:
            break
    return out


def _primary_image_url(restaurant: Restaurant) -> str | None:
    lst = _restaurant_image_urls_list(restaurant)
    return lst[0] if lst else None


def _public_restaurant_filter(q):
    return q.filter(Restaurant.is_deleted.is_(False)).filter(Restaurant.status == "published")


def _main_item_for(restaurant: Restaurant) -> RestaurantMenuItem | None:
    mains = [m for m in restaurant.menu_items if m.is_main_menu]
    if not mains:
        return None
    return mains[0]


def _district_name(db: Session, district_id: int) -> str:
    d = db.query(District).filter(District.id == district_id).first()
    return d.name if d else ""


def _normalized_bro_list_pin(restaurant: Restaurant) -> int | None:
    p = getattr(restaurant, "bro_list_pin", None)
    if p is None:
        return None
    if isinstance(p, int) and 1 <= p <= 4:
        return p
    return None


def _like_counts_map(db: Session, restaurant_ids: list[int]) -> dict[int, int]:
    if not restaurant_ids:
        return {}
    rows = (
        db.query(RestaurantLike.restaurant_id, func.count(RestaurantLike.id))
        .filter(RestaurantLike.restaurant_id.in_(restaurant_ids))
        .group_by(RestaurantLike.restaurant_id)
        .all()
    )
    return {int(rid): int(c) for rid, c in rows}


def _sort_public_brog_list(restaurants: list[Restaurant], like_counts: dict[int, int]) -> None:
    """고정 핀 1~4위(구 내) → 그 외 좋아요 많은 순 → 가게명."""

    def sort_key(r: Restaurant) -> tuple:
        pin = _normalized_bro_list_pin(r)
        lc = like_counts.get(r.id, 0)
        name = (r.name or "").strip()
        if pin is not None:
            return (0, pin, -lc, name)
        return (1, 0, -lc, name)

    restaurants.sort(key=sort_key)


def _list_item_from(db: Session, restaurant: Restaurant) -> dict:
    main = _main_item_for(restaurant)
    if main is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Restaurant has no main menu item",
        )
    district_name = restaurant.district.name if restaurant.district else _district_name(
            db, restaurant.district_id
        )
    img_urls = _restaurant_image_urls_list(restaurant)
    sb_uid, _, sb_role = _submitter_public_fields(db, restaurant)
    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "city": restaurant.city,
        "district_id": restaurant.district_id,
        "district": district_name,
        "category": restaurant.category,
        "summary": restaurant.summary,
        "image_url": img_urls[0] if img_urls else None,
        "image_urls": img_urls,
        "latitude": restaurant.latitude,
        "longitude": restaurant.longitude,
        "main_menu_name": main.name,
        "main_menu_price": main.price_krw,
        "points_eligible": bool(getattr(restaurant, "points_eligible", True)),
        "is_franchise": sb_role == FRANCHISE,
        "submitted_by_user_id": sb_uid,
        "bro_list_pin": _normalized_bro_list_pin(restaurant),
    }


def _submitter_public_fields(db: Session, restaurant: Restaurant) -> tuple[int | None, str | None, str | None]:
    """BroG 등록자(회원·지역담당자·관리자) — 상세 노출·포인트 정산 식별용."""
    uid = restaurant.submitted_by_user_id
    if uid is None:
        return None, None, None
    user_obj = restaurant.submitter
    if user_obj is None:
        user_obj = db.query(User).filter(User.id == uid).first()
    if user_obj is None:
        return uid, None, None
    return uid, user_obj.nickname, user_obj.role


def _detail_item_from(db: Session, restaurant: Restaurant) -> RestaurantDetailRead:
    main = _main_item_for(restaurant)
    if main is None or main.price_krw > MAX_MAIN_MENU_KRW:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    district_name = restaurant.district.name if restaurant.district else _district_name(
        db, restaurant.district_id
    )
    sb_uid, sb_nick, sb_role = _submitter_public_fields(db, restaurant)
    items = sorted(
        restaurant.menu_items,
        key=lambda x: (
            x.card_slot is None,
            x.card_slot or 999,
            not x.is_main_menu,
            x.id,
        ),
    )
    img_urls = _restaurant_image_urls_list(restaurant)
    return RestaurantDetailRead(
        id=restaurant.id,
        name=restaurant.name,
        city=restaurant.city,
        district_id=restaurant.district_id,
        district=district_name,
        category=restaurant.category,
        summary=restaurant.summary,
        image_url=img_urls[0] if img_urls else None,
        image_urls=img_urls,
        points_eligible=bool(getattr(restaurant, "points_eligible", True)),
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        status=restaurant.status,
        is_deleted=restaurant.is_deleted,
        created_at=restaurant.created_at,
        menu_items=[MenuItemRead.model_validate(m) for m in items],
        submitted_by_user_id=sb_uid,
        submitted_by_nickname=sb_nick,
        submitted_by_role=sb_role,
        is_franchise=sb_role == FRANCHISE,
    )


def _replace_menu_items(db: Session, restaurant: Restaurant, payload: RestaurantWrite) -> None:
    extras = payload.extra_card_menus[:3]
    more = payload.more_menu_items[:6]
    all_names = [payload.main_menu_name] + [m.name for m in extras] + [m.name for m in more]
    if len(all_names) != len(set(all_names)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Menu item names must be unique",
        )
    if len({m.name for m in extras}) != len(extras):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="extra_card_menus names must be unique",
        )
    if len({m.name for m in more}) != len(more):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="more_menu_items names must be unique",
        )
    db.query(RestaurantMenuItem).filter(RestaurantMenuItem.restaurant_id == restaurant.id).delete(
        synchronize_session=False,
    )
    db.flush()
    db.add(
        RestaurantMenuItem(
            restaurant_id=restaurant.id,
            name=payload.main_menu_name,
            price_krw=payload.main_menu_price,
            is_main_menu=True,
            card_slot=1,
        )
    )
    for idx, extra in enumerate(extras, start=2):
        db.add(
            RestaurantMenuItem(
                restaurant_id=restaurant.id,
                name=extra.name,
                price_krw=extra.price_krw,
                is_main_menu=False,
                card_slot=idx,
            )
        )
    for m in more:
        db.add(
            RestaurantMenuItem(
                restaurant_id=restaurant.id,
                name=m.name,
                price_krw=m.price_krw,
                is_main_menu=False,
                card_slot=None,
            )
        )


@router.get("", response_model=list[RestaurantListItem])
def list_restaurants(
    district: str | None = None,
    district_id: int | None = Query(default=None, ge=1),
    max_price: int = Query(default=10_000, ge=1, le=10_000),
    limit: int | None = Query(default=None, ge=1, le=200),
    near_lat: float | None = Query(default=None),
    near_lng: float | None = Query(default=None),
    radius_m: int | None = Query(default=None, ge=1, le=15_000),
    db: Session = Depends(get_db),
):
    cap = min(max_price, MAX_MAIN_MENU_KRW)
    q = (
        db.query(Restaurant)
        .join(RestaurantMenuItem)
        .join(District, Restaurant.district_id == District.id)
        .filter(RestaurantMenuItem.is_main_menu.is_(True))
        .filter(RestaurantMenuItem.price_krw <= MAX_MAIN_MENU_KRW)
        .filter(RestaurantMenuItem.price_krw <= cap)
    )
    q = _public_restaurant_filter(q)
    q = q.distinct().options(selectinload(Restaurant.menu_items), selectinload(Restaurant.district))

    stage1 = stage1_district_names()
    if stage1 is not None:
        q = q.filter(District.name.in_(list(stage1)))

    if district_id is not None:
        q = q.filter(Restaurant.district_id == district_id)
    elif district:
        q = q.filter(District.name == district.strip())

    use_near = (
        near_lat is not None
        and near_lng is not None
        and radius_m is not None
    )
    if use_near:
        lat_delta = radius_m / 111_000.0
        cos_lat = max(abs(math.cos(math.radians(near_lat))), 0.25)
        lng_delta = radius_m / (111_000.0 * cos_lat)
        q = q.filter(Restaurant.latitude.isnot(None), Restaurant.longitude.isnot(None))
        q = q.filter(Restaurant.latitude.between(near_lat - lat_delta, near_lat + lat_delta))
        q = q.filter(Restaurant.longitude.between(near_lng - lng_delta, near_lng + lng_delta))

    restaurants = q.all()
    ids = [r.id for r in restaurants]
    like_counts = _like_counts_map(db, ids)
    _sort_public_brog_list(restaurants, like_counts)

    if use_near:
        assert near_lat is not None and near_lng is not None and radius_m is not None
        in_circle: list[Restaurant] = []
        for r in restaurants:
            if r.latitude is None or r.longitude is None:
                continue
            if haversine_m(near_lat, near_lng, float(r.latitude), float(r.longitude)) <= radius_m:
                in_circle.append(r)
        _sort_public_brog_list(in_circle, like_counts)
        cap_n = limit if limit is not None else 200
        restaurants = in_circle[:cap_n]
    elif limit is not None:
        restaurants = restaurants[:limit]

    return [RestaurantListItem.model_validate(_list_item_from(db, r)) for r in restaurants]


@router.post(
    "/{restaurant_id}/cycle-bro-list-pin",
    response_model=BroListPinState,
    summary="BroG 목록 1~4위 고정 핀 순환 (미고정→1→2→3→4→해제)",
)
def cycle_bro_list_pin(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = (
        db.query(Restaurant)
        .filter(
            Restaurant.id == restaurant_id,
            Restaurant.is_deleted.is_(False),
            Restaurant.status == "published",
        )
        .first()
    )
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    ensure_brog_district_access(current_user, r.district_id)

    cur = _normalized_bro_list_pin(r)
    if cur is None:
        new_pin = 1
    elif cur < 4:
        new_pin = cur + 1
    else:
        new_pin = None

    if new_pin is not None:
        (
            db.query(Restaurant)
            .filter(
                Restaurant.district_id == r.district_id,
                Restaurant.id != r.id,
                Restaurant.bro_list_pin == new_pin,
            )
            .update({Restaurant.bro_list_pin: None}, synchronize_session=False)
        )
    r.bro_list_pin = new_pin
    db.add(r)
    db.commit()
    db.refresh(r)
    return BroListPinState(bro_list_pin=_normalized_bro_list_pin(r))


@router.get("/manage/list", response_model=list[RestaurantManageRow])
def list_restaurants_for_manage(
    district_id: int | None = Query(default=None, ge=1),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Restaurant)
    if current_user.role == SUPER_ADMIN:
        if not include_deleted:
            q = q.filter(Restaurant.is_deleted.is_(False))
        if district_id is not None:
            q = q.filter(Restaurant.district_id == district_id)
    elif current_user.role == REGIONAL_MANAGER:
        mid = current_user.managed_district_id
        if mid is None:
            return []
        q = q.filter(Restaurant.district_id == mid)
        q = q.filter(Restaurant.is_deleted.is_(False))
    else:
        q = q.filter(Restaurant.submitted_by_user_id == current_user.id)
        q = q.filter(Restaurant.is_deleted.is_(False))

    rows = (
        q.options(selectinload(Restaurant.district))
        .order_by(Restaurant.updated_at.desc())
        .all()
    )
    return [
        RestaurantManageRow(
            id=r.id,
            name=r.name,
            district_id=r.district_id,
            district=r.district.name if r.district else _district_name(db, r.district_id),
            status=r.status,
            is_deleted=r.is_deleted,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/manage/{restaurant_id}", response_model=RestaurantDetailRead)
def get_restaurant_for_manage(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    restaurant = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    if restaurant.is_deleted and current_user.role != SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    ensure_can_access_brog_manage(current_user, restaurant)
    return _detail_item_from(db, restaurant)


@router.get("/{restaurant_id}", response_model=RestaurantDetailRead)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant or restaurant.is_deleted or restaurant.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    drow = db.query(District).filter(District.id == restaurant.district_id).first()
    dname = drow.name if drow else ""
    if not district_name_in_stage1(dname):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    return _detail_item_from(db, restaurant)


def _persist_new_restaurant(db: Session, current_user: User, payload: RestaurantWrite) -> Restaurant:
    d = db.query(District).filter(District.id == payload.district_id).first()
    if not d or not d.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid district_id")
    if not district_name_in_stage1(d.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="1단계 배포에서는 선택 가능한 구만 등록할 수 있습니다.",
        )

    ensure_can_create_brog_in_chosen_district(current_user, payload.district_id)

    # 지역 담당자 작성은 항상 즉시 공개. 슈퍼만 초안(draft) 선택 가능.
    if current_user.role == SUPER_ADMIN:
        effective_status = payload.status
    else:
        effective_status = "published"

    now = datetime.now(timezone.utc)
    published = effective_status == "published"
    image_urls = coerce_restaurant_image_urls(payload)
    restaurant = Restaurant(
        name=payload.name.strip(),
        city=payload.city,
        district_id=payload.district_id,
        category=payload.category,
        summary=payload.summary,
        image_url=image_urls[0] if image_urls else None,
        image_urls=image_urls if image_urls else None,
        points_eligible=True,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=effective_status,
        submitted_by_user_id=current_user.id,
        approved_by_user_id=current_user.id if published else None,
        approved_at=now if published else None,
    )
    db.add(restaurant)
    db.flush()
    _replace_menu_items(db, restaurant, payload)
    apply_duplicate_restaurant_names_for_new(db, restaurant, payload.name)
    db.commit()
    db.refresh(restaurant)
    loaded = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant.id)
        .first()
    )
    assert loaded is not None
    return loaded


@router.post("", response_model=RestaurantDetailRead, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    payload: RestaurantWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    restaurant = _persist_new_restaurant(db, current_user, payload)
    return _detail_item_from(db, restaurant)


@router.post(
    "/from-myg/{post_id}",
    response_model=RestaurantDetailRead,
    status_code=status.HTTP_201_CREATED,
)
def create_restaurant_from_myg_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인 MyG 글 → 공개 BroG 매장 생성(내용 매핑은 `restaurant_write_from_known_post`)."""
    post = db.query(KnownRestaurantPost).filter(KnownRestaurantPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인 MyG 글만 BroG로 등록할 수 있습니다.",
        )
    try:
        payload = restaurant_write_from_known_post(db, post)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    restaurant = _persist_new_restaurant(db, current_user, payload)
    return _detail_item_from(db, restaurant)


@router.put("/{restaurant_id}", response_model=RestaurantDetailRead)
def update_restaurant(
    restaurant_id: int,
    payload: RestaurantWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    restaurant = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant or restaurant.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    ensure_can_access_brog_manage(current_user, restaurant)
    if payload.district_id != restaurant.district_id and current_user.role != SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can change district",
        )

    d = db.query(District).filter(District.id == payload.district_id).first()
    if not d or not d.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid district_id")
    if not district_name_in_stage1(d.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="1단계 배포에서는 선택 가능한 구만 사용할 수 있습니다.",
        )

    now = datetime.now(timezone.utc)
    if current_user.role == SUPER_ADMIN:
        new_status = payload.status
        if new_status == "published" and restaurant.status != "published":
            restaurant.approved_by_user_id = current_user.id
            restaurant.approved_at = now
        elif new_status == "draft":
            restaurant.approved_by_user_id = None
            restaurant.approved_at = None
        restaurant.status = new_status
    else:
        # 지역 담당자·등록 회원: 수정도 즉시 공개 반영
        if restaurant.status != "published":
            restaurant.approved_by_user_id = current_user.id
            restaurant.approved_at = now
        restaurant.status = "published"
    image_urls = coerce_restaurant_image_urls(payload)
    restaurant.name = payload.name.strip()
    restaurant.city = payload.city
    restaurant.district_id = payload.district_id
    restaurant.category = payload.category
    restaurant.summary = payload.summary
    restaurant.image_url = image_urls[0] if image_urls else None
    restaurant.image_urls = image_urls if image_urls else None
    restaurant.latitude = payload.latitude
    restaurant.longitude = payload.longitude

    _replace_menu_items(db, restaurant, payload)

    db.commit()
    db.refresh(restaurant)
    restaurant = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    assert restaurant is not None
    return _detail_item_from(db, restaurant)


@router.post("/{restaurant_id}/restore", response_model=RestaurantDetailRead)
def restore_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_super_admin_user),
):
    """숨김(소프트 삭제) 해제 — 지도·목록에 다시 노출. 슈퍼만."""
    restaurant = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    if not restaurant.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Restaurant is not hidden",
        )
    restaurant.is_deleted = False
    restaurant.deleted_at = None
    db.commit()
    db.refresh(restaurant)
    restaurant = (
        db.query(Restaurant)
        .options(
            selectinload(Restaurant.menu_items),
            selectinload(Restaurant.district),
            selectinload(Restaurant.submitter),
        )
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    assert restaurant is not None
    return _detail_item_from(db, restaurant)


@router.delete("/{restaurant_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def purge_restaurant_permanent(
    restaurant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_super_admin_user),
):
    """행·메뉴 행을 DB에서 영구 삭제. 슈퍼 관리자 전용."""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    db.delete(restaurant)
    db.commit()


@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """목록·지도에서 숨김(소프트 삭제). 담당 구 권한 또는 슈퍼."""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant or restaurant.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    ensure_can_access_brog_manage(current_user, restaurant)
    restaurant.is_deleted = True
    restaurant.deleted_at = datetime.now(timezone.utc)
    db.commit()
