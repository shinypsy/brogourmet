"""MyG(`KnownRestaurantPost`) → BroG(`RestaurantWrite`) 매핑."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.district import District
from app.models.known_restaurant_post import KnownRestaurantPost
from app.schemas.restaurant import ExtraCardMenuWrite, RestaurantWrite
from app.services.myg_menu_parse import parse_menu_line

BROG_CATEGORIES = frozenset({"한식", "중식", "일식", "양식", "분식", "패스트푸드", "음료"})
MAX_MENU_LINES_BROG = 10
MAX_MAIN_MENU_KRW = 10_000
_EXTRA_MORE_PRICE_CAP = 1_000_000


def restaurant_write_from_known_post(db: Session, post: KnownRestaurantPost) -> RestaurantWrite:
    district_id = post.district_id
    if not district_id:
        dname = (post.district or "").strip()
        if not dname:
            raise ValueError("구 정보가 없어 BroG로 등록할 수 없습니다. 글을 BroG 형식으로 편집해 구를 선택하세요.")
        d = db.query(District).filter(District.name == dname, District.active.is_(True)).first()
        if not d:
            raise ValueError(f"구를 찾을 수 없습니다: {dname}")
        district_id = d.id
    else:
        d = db.query(District).filter(District.id == district_id, District.active.is_(True)).first()
        if not d:
            raise ValueError("유효하지 않은 구(district_id)입니다.")

    cat = (post.category or "").strip()
    if cat not in BROG_CATEGORIES:
        raise ValueError(
            "BroG는 한식·중식·일식·양식·분식·패스트푸드·음료만 가능합니다. "
            "글 편집에서 카테고리와 메뉴 줄 형식을 맞춘 뒤 다시 시도하세요."
        )

    summary = (post.summary or post.body or "").strip()
    if not summary:
        raise ValueError("소개·본문이 비어 있으면 BroG에 등록할 수 없습니다.")

    menu_text = (post.menu_lines or "").strip()
    if not menu_text:
        menu_text = f"{post.main_menu_name.strip()} : {int(post.main_menu_price)}원"

    raw_lines = [ln.strip() for ln in menu_text.splitlines() if ln.strip()]
    if len(raw_lines) > MAX_MENU_LINES_BROG:
        raise ValueError(f"메뉴는 최대 {MAX_MENU_LINES_BROG}줄까지입니다.")

    use_lines = raw_lines[:MAX_MENU_LINES_BROG]
    parsed_rows: list = []
    errors: list[str] = []
    for i, line in enumerate(use_lines):
        row = parse_menu_line(line)
        if row is None:
            errors.append(
                f'{i + 1}번째 줄을 읽지 못했습니다. "메뉴명 : 가격" 형식인지 확인하세요.'
            )
        else:
            parsed_rows.append(row)
    if errors:
        raise ValueError(" ".join(errors))
    if not parsed_rows:
        raise ValueError("유효한 메뉴 줄이 없습니다.")

    main = parsed_rows[0]
    if main.price_krw > MAX_MAIN_MENU_KRW:
        raise ValueError("대표 메뉴(첫 줄) 가격은 10,000원 이하여야 합니다(BroG 규칙).")

    def _cap(p: int) -> int:
        return min(p, _EXTRA_MORE_PRICE_CAP)

    extras = [
        ExtraCardMenuWrite(name=r.name, price_krw=_cap(r.price_krw)) for r in parsed_rows[1:4]
    ]
    more = [
        ExtraCardMenuWrite(name=r.name, price_krw=_cap(r.price_krw))
        for r in parsed_rows[4:MAX_MENU_LINES_BROG]
    ]

    imgs: list[str] = []
    if post.image_urls:
        for u in post.image_urls:
            t = (u or "").strip()[:500]
            if t and t not in imgs:
                imgs.append(t)
            if len(imgs) >= 5:
                break
    if post.image_url and post.image_url.strip():
        u = post.image_url.strip()[:500]
        if u not in imgs:
            imgs = [u] + [x for x in imgs if x != u][:4]

    return RestaurantWrite(
        name=post.restaurant_name.strip()[:200],
        city=(post.city or "서울특별시").strip()[:100],
        district_id=district_id,
        category=cat,  # type: ignore[arg-type]
        summary=summary[:8000],
        image_url=imgs[0] if imgs else None,
        image_urls=imgs,
        latitude=post.latitude,
        longitude=post.longitude,
        main_menu_name=main.name[:200],
        main_menu_price=main.price_krw,
        extra_card_menus=extras,
        more_menu_items=more,
        status="published",
    )
