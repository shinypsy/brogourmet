from sqlalchemy.orm import Session

from app.models.district import District
from app.models.restaurant import Restaurant, RestaurantMenuItem

_SAMPLE_FOOD_IMAGES = [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1579584421335-c3e9bc87fad0?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&w=480&q=80",
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&w=480&q=80",
]

_DISTRICT_SEED: list[tuple[str, int]] = [
    ("마포구", 1),
    ("용산구", 2),
    ("서대문구", 3),
    ("영등포구", 4),
    ("종로구", 5),
    ("중구", 6),
    ("강남구", 20),
    ("송파구", 21),
    ("성동구", 22),
]


def seed_districts(db: Session) -> None:
    if db.query(District).count() > 0:
        return
    for name, sort_order in _DISTRICT_SEED:
        db.add(District(name=name, active=True, sort_order=sort_order))
    db.commit()


def _did(db: Session, name: str) -> int:
    d = db.query(District).filter(District.name == name).first()
    assert d is not None, f"district not seeded: {name}"
    return d.id


def seed_restaurants(db: Session) -> None:
    if db.query(Restaurant).count() > 0:
        return

    specs: list[dict] = [
        {
            "district": "강남구",
            "name": "강남 국밥 연구소",
            "category": "한식",
            "summary": "든든한 국밥과 깔끔한 반찬 구성이 강점인 직장인 점심 맛집입니다.",
            "image_i": 0,
            "lat": 37.498,
            "lng": 127.028,
            "menus": [
                ("수육국밥", 9000, True, 1),
                ("수육 추가", 12000, False, None),
            ],
        },
        {
            "district": "강남구",
            "name": "강남 덮밥 연구소",
            "category": "일식",
            "summary": "대표 메뉴는 1만원 이하로 즐기고, 추가 메뉴는 선택적으로 주문할 수 있습니다.",
            "image_i": 1,
            "lat": 37.500,
            "lng": 127.036,
            "menus": [
                ("연어덮밥", 10000, True, 1),
                ("사이드 사시미", 14000, False, None),
            ],
        },
        {
            "district": "마포구",
            "name": "연남동 파스타 하우스",
            "category": "양식",
            "summary": "대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.",
            "image_i": 2,
            "lat": 37.560,
            "lng": 126.925,
            "menus": [
                ("런치 토마토 파스타", 10000, True, 1),
                ("트러플 크림 파스타", 16000, False, None),
            ],
        },
        {
            "district": "마포구",
            "name": "망원 수제버거 키친",
            "category": "패스트푸드",
            "summary": "기본 버거는 부담 없이 즐기고, 추가 토핑 메뉴는 부메뉴로 확장되는 구조입니다.",
            "image_i": 3,
            "lat": 37.556,
            "lng": 126.910,
            "menus": [
                ("클래식 버거", 8000, True, 1),
                ("더블치즈 버거", 12500, False, None),
            ],
        },
        {
            "district": "송파구",
            "name": "송리단길 스시 바",
            "category": "일식",
            "summary": "런치 대표 메뉴로 가볍게 입문할 수 있고, 추가 세트는 별도 선택이 가능합니다.",
            "image_i": 4,
            "lat": 37.514,
            "lng": 127.105,
            "menus": [
                ("런치 초밥 8pcs", 10000, True, 1),
                ("특선 초밥 12pcs", 18000, False, None),
            ],
        },
        {
            "district": "송파구",
            "name": "잠실 냉면정",
            "category": "한식",
            "summary": "맑은 육수와 부드러운 면발로 여름철 방문이 많은 냉면집입니다.",
            "image_i": 5,
            "lat": 37.513,
            "lng": 127.100,
            "menus": [
                ("평양냉면", 9500, True, 1),
                ("수육 반접시", 15000, False, None),
            ],
        },
        {
            "district": "종로구",
            "name": "광화문 한옥밥상",
            "category": "한식",
            "summary": "관광객과 직장인 모두가 부담 없이 먹을 수 있는 정식 메뉴가 강점입니다.",
            "image_i": 6,
            "lat": 37.576,
            "lng": 126.977,
            "menus": [
                ("제육정식", 9000, True, 1),
                ("한옥 수육전골", 17000, False, None),
            ],
        },
        {
            "district": "성동구",
            "name": "성수 화덕피자 공방",
            "category": "양식",
            "summary": "조각 세트로 가볍게 즐길 수 있고, 화덕피자 한 판은 부메뉴로 제공됩니다.",
            "image_i": 7,
            "lat": 37.544,
            "lng": 127.055,
            "menus": [
                ("조각 피자 세트", 7000, True, 1),
                ("마르게리타 피자 한 판", 17000, False, None),
            ],
        },
    ]

    for spec in specs:
        did = _did(db, spec["district"])
        r = Restaurant(
            name=spec["name"],
            city="서울특별시",
            district_id=did,
            category=spec["category"],
            summary=spec["summary"],
            image_url=_SAMPLE_FOOD_IMAGES[spec["image_i"]],
            latitude=spec["lat"],
            longitude=spec["lng"],
            status="published",
        )
        db.add(r)
        db.flush()
        for mname, price, is_main, slot in spec["menus"]:
            db.add(
                RestaurantMenuItem(
                    restaurant_id=r.id,
                    name=mname,
                    price_krw=price,
                    is_main_menu=is_main,
                    card_slot=slot,
                )
            )

    db.commit()
