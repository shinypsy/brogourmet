from sqlalchemy.orm import Session

from app.core.deploy_stage1 import DEFAULT_STAGE1_DISTRICTS
from app.models.district import District
from app.models.restaurant import Restaurant, RestaurantMenuItem

# 브라우저 Referer·CDN 정책으로 언스플래시 직링크가 깨질 수 있어 picsum 고정 시드 URL 사용.
_SAMPLE_FOOD_IMAGES = [f"https://picsum.photos/seed/brogourmet{i}/480/360" for i in range(12)]

_DISTRICT_SEED: list[tuple[str, int]] = [
    (name, idx) for idx, name in enumerate(DEFAULT_STAGE1_DISTRICTS, start=1)
]

# BroG 리스트·지도 기본 구(마포구) 데모: 1만 원 이하 대표 메뉴 6곳 + 다중 이미지 샘플 1곳.
# districts 시드: `deploy_stage1.DEFAULT_STAGE1_DISTRICTS`(서울 25구)와 동일 순서.
MAPO_BROG_DEMO_SPECS: list[dict] = [
    {
        "district": "마포구",
        "name": "연남동 파스타 하우스",
        "category": "양식",
        "summary": "대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.",
        "image_urls_i": [2, 6, 0],
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
        "district": "마포구",
        "name": "합정 돈가스 살롱",
        "category": "일식",
        "summary": "바삭한 튀김옷과 진한 소스, 점심 특선으로 부담 없는 가격대를 유지합니다.",
        "image_i": 9,
        "lat": 37.549,
        "lng": 126.914,
        "menus": [
            ("등심돈까스 정식", 9000, True, 1),
            ("치즈 돈까스", 11000, False, None),
        ],
    },
    {
        "district": "마포구",
        "name": "상수동 쌀국수 길",
        "category": "분식",
        "summary": "향신료를 줄인 국물과 쌀면으로 가볍게 먹기 좋은 동남아 스타일 쌀국수 전문입니다.",
        "image_i": 8,
        "lat": 37.547,
        "lng": 126.922,
        "menus": [
            ("얼큰 쌀국수", 9500, True, 1),
            ("짜조 반채", 6000, False, None),
        ],
    },
    {
        "district": "마포구",
        "name": "DMC역 김치찌개 백반",
        "category": "한식",
        "summary": "직장인 단골이 많은 백반집으로, 김치찌개와 반찬이 안정적인 편입니다.",
        "image_i": 10,
        "lat": 37.577,
        "lng": 126.897,
        "menus": [
            ("김치찌개 백반", 9000, True, 1),
            ("제육볶음 추가", 8000, False, None),
        ],
    },
    {
        "district": "마포구",
        "name": "홍대 입구 에그토스트",
        "category": "패스트푸드",
        "summary": "이동 중에도 먹기 좋은 에그토스트와 음료 조합이 인기입니다.",
        "image_i": 11,
        "lat": 37.556,
        "lng": 126.923,
        "menus": [
            ("베이컨 에그토스트", 5000, True, 1),
            ("아메리카노", 3000, False, None),
        ],
    },
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


def _resolve_sample_images(spec: dict) -> tuple[str | None, list[str] | None]:
    if "image_urls_i" in spec:
        urls = [_SAMPLE_FOOD_IMAGES[i] for i in spec["image_urls_i"]]
        return urls[0], urls
    i = int(spec["image_i"])
    u = _SAMPLE_FOOD_IMAGES[i]
    return u, None


def _add_restaurant_from_spec(db: Session, spec: dict) -> None:
    did = _did(db, spec["district"])
    image_url, image_urls = _resolve_sample_images(spec)
    r = Restaurant(
        name=spec["name"],
        city="서울특별시",
        district_id=did,
        category=spec["category"],
        summary=spec["summary"],
        image_url=image_url,
        image_urls=image_urls,
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
        *MAPO_BROG_DEMO_SPECS,
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
        _add_restaurant_from_spec(db, spec)

    db.commit()


def ensure_mapo_brog_demo_restaurants(db: Session) -> None:
    """기존 DB에도 마포구 데모 BroG 6곳이 없으면 추가(이름 기준 idempotent)."""
    mapo = db.query(District).filter(District.name == "마포구").first()
    if mapo is None:
        return
    did = mapo.id
    added = False
    for spec in MAPO_BROG_DEMO_SPECS:
        exists = (
            db.query(Restaurant)
            .filter(Restaurant.district_id == did, Restaurant.name == spec["name"])
            .first()
        )
        if exists is not None:
            continue
        _add_restaurant_from_spec(db, spec)
        added = True

    # 예전 시드(단일 image_url만 있던 연남동) → 갤러리 데모용 다중 URL 보강
    yeonnam = (
        db.query(Restaurant)
        .filter(Restaurant.district_id == did, Restaurant.name == "연남동 파스타 하우스")
        .first()
    )
    if yeonnam is not None and not yeonnam.image_urls:
        gallery = [_SAMPLE_FOOD_IMAGES[i] for i in [2, 6, 0]]
        yeonnam.image_urls = gallery
        yeonnam.image_url = gallery[0]
        added = True

    if added:
        db.commit()
