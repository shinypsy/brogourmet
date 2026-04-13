import json
import logging
import math
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
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
from app.models.site_event import SiteEvent
from app.models.user import User
from app.geo_utils import haversine_m
from app.services.myg_to_brog import restaurant_write_from_known_post
from app.services.restaurant_franchise_display import effective_restaurant_is_franchise
from app.schemas.restaurant import (
    BroListPinState,
    MenuItemRead,
    RestaurantDetailRead,
    RestaurantListItem,
    RestaurantManageRow,
    RestaurantWrite,
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

_log = logging.getLogger(__name__)

MAX_MAIN_MENU_KRW = 10_000
MAX_RESTAURANT_IMAGES = 6
# BroG 신규 등록(포인트 적립 대상 `points_eligible`) 시 작성자 가산 포인트
BROG_CREATE_POINTS_USER = 100
BROG_CREATE_POINTS_REGIONAL_MANAGER = 200
# 위도·경도 각각 이 차이 이하면 같은 매장 좌표로 본다 (~수십 m)
SAME_PLACE_LATLON_EPS = 0.00028
# 동일 장소·동일 베이스 이름 그룹에서 등록순 첫 매장 표시(구 규칙: 이름 끝 `_*` — 레거시 DB 호환은 `restaurant_name_base`에서 처리)
DUPLICATE_GROUP_PRIMARY_NAME_SUFFIX = "(원조!!!)"


def restaurant_name_base(name: str) -> str:
    """표시용 접미사((원조!!!), _*, _1, _2)를 제거한 브랜드 키."""
    t = (name or "").strip()
    suf = DUPLICATE_GROUP_PRIMARY_NAME_SUFFIX
    if len(t) > len(suf) and t.endswith(suf):
        return t[: -len(suf)]
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


def _collapse_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _geo_bucket(lat: float | None, lon: float | None) -> str:
    if lat is None or lon is None:
        return "no_geo"
    qlat = round(lat / SAME_PLACE_LATLON_EPS)
    qlon = round(lon / SAME_PLACE_LATLON_EPS)
    return f"{qlat}|{qlon}"


def _menu_signature_from_payload(payload: RestaurantWrite) -> str:
    parts = [f"M:{payload.main_menu_name.strip().lower()}:{payload.main_menu_price}"]
    for extra in sorted(
        payload.extra_card_menus[:3],
        key=lambda x: (x.name.strip().lower(), x.price_krw),
    ):
        parts.append(f"E:{extra.name.strip().lower()}:{extra.price_krw}")
    for m in sorted(
        payload.more_menu_items[:6],
        key=lambda x: (x.name.strip().lower(), x.price_krw),
    ):
        parts.append(f"O:{m.name.strip().lower()}:{m.price_krw}")
    return "|".join(parts)


def _menu_signature_from_restaurant(r: Restaurant) -> str:
    items = list(r.menu_items or [])
    main = next((m for m in items if m.is_main_menu), None)
    if main is None:
        return ""
    parts = [f"M:{main.name.strip().lower()}:{main.price_krw}"]
    extras = sorted(
        [m for m in items if not m.is_main_menu and m.card_slot is not None],
        key=lambda m: (m.name.strip().lower(), m.price_krw),
    )
    for m in extras:
        parts.append(f"E:{m.name.strip().lower()}:{m.price_krw}")
    others = sorted(
        [m for m in items if not m.is_main_menu and m.card_slot is None],
        key=lambda m: (m.name.strip().lower(), m.price_krw),
    )
    for m in others:
        parts.append(f"O:{m.name.strip().lower()}:{m.price_krw}")
    return "|".join(parts)


def _brog_content_fingerprint_from_payload(payload: RestaurantWrite) -> tuple:
    imgs = tuple(sorted(coerce_restaurant_image_urls(payload)))
    return (
        payload.district_id,
        restaurant_name_base(payload.name.strip()).lower(),
        _collapse_ws(payload.city).lower(),
        payload.category,
        _collapse_ws(payload.summary).lower(),
        _geo_bucket(payload.latitude, payload.longitude),
        imgs,
        _menu_signature_from_payload(payload),
    )


def _brog_content_fingerprint_from_restaurant(r: Restaurant) -> tuple:
    imgs = tuple(sorted(_restaurant_image_urls_list(r)))
    return (
        r.district_id,
        restaurant_name_base(r.name).lower(),
        _collapse_ws(r.city).lower(),
        (r.category or "").strip().lower(),
        _collapse_ws(r.summary or "").lower(),
        _geo_bucket(r.latitude, r.longitude),
        imgs,
        _menu_signature_from_restaurant(r),
    )


def _ensure_not_identical_brog_submission(db: Session, user_id: int, payload: RestaurantWrite) -> None:
    """
    동일 구·동일 베이스 이름·소개·메뉴·사진 URL·좌표(격자)까지 같은 신규 등록은 거절.
    - 본인이 이전에 올린 글과 같으면: 수정 안내
    - 다른 사람 글과 내용이 완전히 같으면: 복붙·표절 차단
    """
    want = _brog_content_fingerprint_from_payload(payload)
    candidates = (
        db.query(Restaurant)
        .options(selectinload(Restaurant.menu_items))
        .filter(
            Restaurant.district_id == payload.district_id,
            Restaurant.is_deleted.is_(False),
        )
        .all()
    )
    for r in candidates:
        if restaurant_name_base(r.name).lower() != restaurant_name_base(payload.name.strip()).lower():
            continue
        if _brog_content_fingerprint_from_restaurant(r) != want:
            continue
        if r.submitted_by_user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "이미 같은 내용으로 등록한 BroG가 있습니다. "
                    "기존 매장을 「수정」하거나, 소개·메뉴·사진 등을 바꾼 뒤 다시 등록해 주세요."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "동일한 내용의 BroG가 이미 등록되어 있습니다. "
                "다른 글을 그대로 복사해 올릴 수 없습니다."
            ),
        )


def _credit_brog_creation_author_points(db: Session, author: User, restaurant: Restaurant) -> None:
    """`points_eligible`인 BroG 최초 등록 건에 대해 작성자 포인트 적립."""
    if not restaurant.points_eligible:
        return
    u = db.query(User).filter(User.id == author.id).first()
    if u is None:
        return
    delta = (
        BROG_CREATE_POINTS_REGIONAL_MANAGER
        if author.role == REGIONAL_MANAGER
        else BROG_CREATE_POINTS_USER
    )
    prev = int(getattr(u, "points_balance", 0) or 0)
    u.points_balance = prev + delta


def apply_duplicate_restaurant_names_for_new(db: Session, restaurant: Restaurant, submitted_name: str) -> None:
    """동일 구·근접 좌표·동일 베이스 이름이 2건 이상이면 등록순으로 …(원조!!!), …_1, …_2. 첫 건만 포인트 적립."""
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
        suffix = DUPLICATE_GROUP_PRIMARY_NAME_SUFFIX if i == 0 else f"_{i}"
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
    try:
        n = int(p)
    except (TypeError, ValueError):
        return None
    if 1 <= n <= 4:
        return n
    return None


def _occupied_bro_list_pin_slots(
    db: Session, district_id: int, *, exclude_restaurant_id: int
) -> set[int]:
    """같은 구에서 이미 쓰인 고정 슬롯(1~4). exclude 행은 제외(미고정 배정 시 본인 제외)."""
    rows = (
        db.query(Restaurant.bro_list_pin)
        .filter(
            Restaurant.district_id == district_id,
            Restaurant.id != exclude_restaurant_id,
            Restaurant.is_deleted.is_(False),
            Restaurant.status == "published",
            Restaurant.bro_list_pin.isnot(None),
        )
        .all()
    )
    used: set[int] = set()
    for (p,) in rows:
        try:
            n = int(p)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 4:
            used.add(n)
    return used


def _next_free_bro_list_pin_slot(
    db: Session, district_id: int, *, exclude_restaurant_id: int
) -> int | None:
    used = _occupied_bro_list_pin_slots(db, district_id, exclude_restaurant_id=exclude_restaurant_id)
    for slot in (1, 2, 3, 4):
        if slot not in used:
            return slot
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


def _active_site_event_restaurant_ids(db: Session, restaurant_ids: list[int]) -> set[int]:
    """활성 가맹점 연동 이벤트가 있는 BroG id 집합. 스키마 미적용 시 빈 집합."""
    if not restaurant_ids:
        return set()
    try:
        rows = (
            db.query(SiteEvent.restaurant_id)
            .filter(
                SiteEvent.restaurant_id.in_(restaurant_ids),
                SiteEvent.is_active.is_(True),
            )
            .distinct()
            .all()
        )
        return {row[0] for row in rows if row[0] is not None}
    except (OperationalError, ProgrammingError) as exc:
        _log.warning("active site event restaurant id set skipped: %s", exc)
        return set()


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


def _fetch_district_bro_list_pins(
    db: Session,
    *,
    price_cap: int,
    district: str | None,
    district_id: int | None,
    stage1: frozenset[str] | None,
) -> list[Restaurant]:
    """선택 구·가격 조건에 맞는 목록 고정(pin 1~4) BroG. 반경 필터 없음."""
    if district_id is None and not (district and district.strip()):
        return []
    q = (
        db.query(Restaurant)
        .join(RestaurantMenuItem)
        .join(District, Restaurant.district_id == District.id)
        .filter(RestaurantMenuItem.is_main_menu.is_(True))
        .filter(RestaurantMenuItem.price_krw <= MAX_MAIN_MENU_KRW)
        .filter(RestaurantMenuItem.price_krw <= price_cap)
    )
    q = _public_restaurant_filter(q)
    q = q.distinct().options(
        selectinload(Restaurant.menu_items),
        selectinload(Restaurant.district),
        selectinload(Restaurant.submitter),
    )
    if stage1 is not None:
        q = q.filter(District.name.in_(list(stage1)))
    if district_id is not None:
        q = q.filter(Restaurant.district_id == district_id)
    else:
        q = q.filter(District.name == district.strip())
    q = q.filter(Restaurant.bro_list_pin.in_((1, 2, 3, 4)))
    return list(q.all())


def _prepend_district_pins_to_near_list(
    near_ordered: list[Restaurant],
    pinned: list[Restaurant],
    max_rows: int,
) -> list[Restaurant]:
    """고정 1~4위를 앞에 두고, 이어서 반경 내 목록(중복 제외)."""
    if not pinned:
        return near_ordered[:max_rows]
    pin_sorted = sorted(
        pinned,
        key=lambda r: (_normalized_bro_list_pin(r) or 99, (r.name or "").strip()),
    )
    seen: set[int] = set()
    merged: list[Restaurant] = []
    for r in pin_sorted:
        if r.id not in seen:
            seen.add(r.id)
            merged.append(r)
    for r in near_ordered:
        if r.id not in seen:
            seen.add(r.id)
            merged.append(r)
    return merged[:max_rows]


def _list_item_from(db: Session, restaurant: Restaurant, *, has_active_site_event: bool = False) -> dict:
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
    sb_uid, sb_nick, sb_role = _submitter_public_fields(db, restaurant)
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
        "is_franchise": effective_restaurant_is_franchise(
            getattr(restaurant, "franchise_pin", None),
            sb_role,
        ),
        "submitted_by_user_id": sb_uid,
        "submitted_by_nickname": sb_nick,
        "bro_list_pin": _normalized_bro_list_pin(restaurant),
        "has_active_site_event": has_active_site_event,
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
    ev_bodies: list[str] = []
    try:
        rows = (
            db.query(SiteEvent.body)
            .filter(
                SiteEvent.restaurant_id == restaurant.id,
                SiteEvent.is_active.is_(True),
            )
            .order_by(SiteEvent.created_at.desc())
            .all()
        )
        for row in rows:
            raw = row[0]
            if raw is None:
                continue
            s = raw.strip() if isinstance(raw, str) else str(raw).strip()
            if s:
                ev_bodies.append(s)
    except (OperationalError, ProgrammingError) as exc:
        # DB에 `site_events.restaurant_id` 미적용 등 — 상세는 열리고 이벤트 본문만 생략
        _log.warning("active site event bodies skipped for restaurant %s: %s", restaurant.id, exc)
    has_active_site_event = len(ev_bodies) > 0
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
        is_franchise=effective_restaurant_is_franchise(
            getattr(restaurant, "franchise_pin", None),
            sb_role,
        ),
        has_active_site_event=has_active_site_event,
        active_site_event_bodies=ev_bodies,
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
    near_ignore_district: bool = Query(
        default=False,
        description="True면 반경 검색 시 district 필터를 생략(URL 구·좌표 불일치 완화). 구 드롭다운 변경 후에는 false로 보냄.",
    ),
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
    q = q.distinct().options(
        selectinload(Restaurant.menu_items),
        selectinload(Restaurant.district),
        selectinload(Restaurant.submitter),
    )

    stage1 = stage1_district_names()
    if stage1 is not None:
        q = q.filter(District.name.in_(list(stage1)))

    use_near = (
        near_lat is not None
        and near_lng is not None
        and radius_m is not None
    )
    # 반경+near_ignore_district 일 때만 구 필터 생략(GPS·지도 찍기로 좌표만 있고 URL 구가 어긋날 때).
    # 그 외(near + 구)는 AND — BroG 지도에서 구 선택 시 해당 구·반경만.
    if not use_near:
        if district_id is not None:
            q = q.filter(Restaurant.district_id == district_id)
        elif district:
            q = q.filter(District.name == district.strip())
    elif not near_ignore_district:
        if district_id is not None:
            q = q.filter(Restaurant.district_id == district_id)
        elif district:
            q = q.filter(District.name == district.strip())
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
        # 반경 밖에 있어도 **기준점이 속한 구**(가장 가까운 맛집의 구) 고정 1~4위를 앞에 둠.
        # 요청 district는 반경 쿼리에 쓰이지 않으므로, pin도 좌표 기준 구를 쓴다(마포 URL+용산 찍기 등).
        if limit is None:
            pin_district: str | None = district.strip() if (district and district.strip()) else None
            pin_district_id: int | None = district_id
            if in_circle:
                best = min(
                    in_circle,
                    key=lambda r: haversine_m(
                        near_lat, near_lng, float(r.latitude), float(r.longitude)
                    ),
                )
                pin_district_id = best.district_id
                pin_district = None
            if pin_district_id is not None or (pin_district and pin_district.strip()):
                pinned_rows = _fetch_district_bro_list_pins(
                    db,
                    price_cap=cap,
                    district=pin_district,
                    district_id=pin_district_id,
                    stage1=stage1,
                )
                restaurants = _prepend_district_pins_to_near_list(restaurants, pinned_rows, cap_n)
    elif limit is not None:
        restaurants = restaurants[:limit]

    ev_ids = _active_site_event_restaurant_ids(db, [r.id for r in restaurants])
    return [
        RestaurantListItem.model_validate(
            _list_item_from(db, r, has_active_site_event=r.id in ev_ids),
        )
        for r in restaurants
    ]


@router.post(
    "/{restaurant_id}/cycle-bro-list-pin",
    response_model=BroListPinState,
    summary="BroG 목록 고정: 미고정 시 구 내 빈 슬롯(1~4) 배정, 이후 1→2→3→4→해제 순환",
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
        new_pin = _next_free_bro_list_pin_slot(db, r.district_id, exclude_restaurant_id=r.id)
        if new_pin is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이 구의 고정 슬롯 4개가 모두 사용 중입니다. 고정 해제 후 다시 시도하세요.",
            )
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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "bro_list_pin에 잘못된 전역 UNIQUE 제약이 있어 같은 구에서 여러 고정을 둘 수 없습니다. "
                "백엔드를 재시작하면 자동으로 제거를 시도합니다. 수동이면 sql/repair_bro_list_pin_global_unique.sql 을 참고하세요."
            ),
        ) from exc
    db.refresh(r)
    return BroListPinState(bro_list_pin=_normalized_bro_list_pin(r))


@router.post(
    "/{restaurant_id}/clear-bro-list-pin",
    response_model=BroListPinState,
    summary="BroG 목록 고정 핀 즉시 해제 (이 카드만, 슬롯 비움)",
)
def clear_bro_list_pin(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """순환(1→2→…) 없이 바로 해제 — 다른 맛집에 같은 슬롯을 주기 전에 현재 카드만 비울 때."""
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
    r.bro_list_pin = None
    db.add(r)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "bro_list_pin에 잘못된 전역 UNIQUE 제약이 있을 수 있습니다. "
                "환경변수 BROG_REPAIR_BRO_LIST_PIN_UNIQUE=1 로 한 번 기동하거나 sql/repair_bro_list_pin_global_unique.sql 을 참고하세요."
            ),
        ) from exc
    db.refresh(r)
    return BroListPinState(bro_list_pin=None)


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
    _ensure_not_identical_brog_submission(db, current_user.id, payload)

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
    _credit_brog_creation_author_points(db, current_user, restaurant)
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
