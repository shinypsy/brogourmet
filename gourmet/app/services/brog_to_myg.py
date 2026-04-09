"""BroG(`Restaurant` + 메뉴) → MyG(`KnownRestaurantPostCreate`) 매핑."""

from __future__ import annotations

from app.models.restaurant import Restaurant
from app.schemas.community import KnownRestaurantPostCreate


def _image_urls_for_post(r: Restaurant, max_n: int = 5) -> list[str]:
    raw: list[str] = []
    if r.image_urls:
        for u in r.image_urls:
            t = (u or "").strip()[:500]
            if t and t not in raw:
                raw.append(t)
            if len(raw) >= max_n:
                break
    if r.image_url and r.image_url.strip():
        u = r.image_url.strip()[:500]
        if u not in raw:
            raw = [u] + [x for x in raw if x != u][: max_n - 1]
    return raw[:max_n]


def build_known_restaurant_create_from_brog(r: Restaurant) -> KnownRestaurantPostCreate:
    """`district`·`menu_items` 관계가 로드된 `Restaurant` 필요."""
    d = r.district
    district_name = (d.name if d else "").strip()[:50]
    imgs = _image_urls_for_post(r)

    menu_items = list(r.menu_items)
    if menu_items:
        mains = [m for m in menu_items if m.is_main_menu]
        others = [m for m in menu_items if not m.is_main_menu]
        others_sorted = sorted(
            others,
            key=lambda m: (m.card_slot is None, m.card_slot if m.card_slot is not None else 999, m.id),
        )
        ordered = mains + others_sorted
        lines = [f"{m.name.strip()} : {m.price_krw}원" for m in ordered if m.name.strip()]
        menu_lines = "\n".join(lines)
        if menu_lines.strip():
            return KnownRestaurantPostCreate(
                restaurant_name=r.name.strip()[:200],
                district_id=r.district_id,
                city=(r.city or "서울특별시").strip()[:100],
                category=r.category.strip()[:80],
                summary=r.summary.strip(),
                menu_lines=menu_lines,
                latitude=r.latitude,
                longitude=r.longitude,
                image_urls=imgs,
                image_url=imgs[0] if imgs else (r.image_url.strip()[:500] if r.image_url else None),
                title=r.name.strip()[:200],
                body=r.summary.strip()[:8000],
            )

    return KnownRestaurantPostCreate(
        restaurant_name=r.name.strip()[:200],
        district=district_name,
        title=r.name.strip()[:200],
        body=r.summary.strip()[:8000],
        main_menu_name="메뉴 미등록",
        main_menu_price=0,
        image_url=imgs[0] if imgs else (r.image_url.strip()[:500] if r.image_url else None),
        image_urls=imgs,
        city=(r.city or "서울특별시").strip()[:100],
        category=r.category.strip()[:80] if r.category else None,
        summary=r.summary.strip() if r.summary else None,
        latitude=r.latitude,
        longitude=r.longitude,
        district_id=None,
        menu_lines=None,
    )
