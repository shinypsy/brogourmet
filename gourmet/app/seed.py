from sqlalchemy.orm import Session

from app.models.restaurant import Restaurant, RestaurantMenuItem


# BroG 카드용 샘플 이미지(주메뉴·매장 분위기 대체). 운영 시 실제 사진 URL로 교체.
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


def seed_restaurants(db: Session) -> None:
    if db.query(Restaurant).count() > 0:
        return

    rows: list[tuple[Restaurant, list[tuple[str, int, bool]]]] = [
        (
            Restaurant(
                name="강남 국밥 연구소",
                city="서울특별시",
                district="강남구",
                category="한식",
                summary="든든한 국밥과 깔끔한 반찬 구성이 강점인 직장인 점심 맛집입니다.",
                image_url=_SAMPLE_FOOD_IMAGES[0],
                latitude=37.498,
                longitude=127.028,
            ),
            [("수육국밥", 9000, True), ("수육 추가", 12000, False)],
        ),
        (
            Restaurant(
                name="강남 덮밥 연구소",
                city="서울특별시",
                district="강남구",
                category="일식",
                summary="대표 메뉴는 1만원 이하로 즐기고, 추가 메뉴는 선택적으로 주문할 수 있습니다.",
                image_url=_SAMPLE_FOOD_IMAGES[1],
                latitude=37.500,
                longitude=127.036,
            ),
            [("연어덮밥", 10000, True), ("사이드 사시미", 14000, False)],
        ),
        (
            Restaurant(
                name="연남동 파스타 하우스",
                city="서울특별시",
                district="마포구",
                category="양식",
                summary="대표 주 메뉴는 1만원 이하, 프리미엄 파스타는 부메뉴로 선택할 수 있는 매장입니다.",
                image_url=_SAMPLE_FOOD_IMAGES[2],
                latitude=37.560,
                longitude=126.925,
            ),
            [("런치 토마토 파스타", 10000, True), ("트러플 크림 파스타", 16000, False)],
        ),
        (
            Restaurant(
                name="망원 수제버거 키친",
                city="서울특별시",
                district="마포구",
                category="패스트푸드",
                summary="기본 버거는 부담 없이 즐기고, 추가 토핑 메뉴는 부메뉴로 확장되는 구조입니다.",
                image_url=_SAMPLE_FOOD_IMAGES[3],
                latitude=37.556,
                longitude=126.910,
            ),
            [("클래식 버거", 8000, True), ("더블치즈 버거", 12500, False)],
        ),
        (
            Restaurant(
                name="송리단길 스시 바",
                city="서울특별시",
                district="송파구",
                category="일식",
                summary="런치 대표 메뉴로 가볍게 입문할 수 있고, 추가 세트는 별도 선택이 가능합니다.",
                image_url=_SAMPLE_FOOD_IMAGES[4],
                latitude=37.514,
                longitude=127.105,
            ),
            [("런치 초밥 8pcs", 10000, True), ("특선 초밥 12pcs", 18000, False)],
        ),
        (
            Restaurant(
                name="잠실 냉면정",
                city="서울특별시",
                district="송파구",
                category="한식",
                summary="맑은 육수와 부드러운 면발로 여름철 방문이 많은 냉면집입니다.",
                image_url=_SAMPLE_FOOD_IMAGES[5],
                latitude=37.513,
                longitude=127.100,
            ),
            [("평양냉면", 9500, True), ("수육 반접시", 15000, False)],
        ),
        (
            Restaurant(
                name="광화문 한옥밥상",
                city="서울특별시",
                district="종로구",
                category="한식",
                summary="관광객과 직장인 모두가 부담 없이 먹을 수 있는 정식 메뉴가 강점입니다.",
                image_url=_SAMPLE_FOOD_IMAGES[6],
                latitude=37.576,
                longitude=126.977,
            ),
            [("제육정식", 9000, True), ("한옥 수육전골", 17000, False)],
        ),
        (
            Restaurant(
                name="성수 화덕피자 공방",
                city="서울특별시",
                district="성동구",
                category="양식",
                summary="조각 세트로 가볍게 즐길 수 있고, 화덕피자 한 판은 부메뉴로 제공됩니다.",
                image_url=_SAMPLE_FOOD_IMAGES[7],
                latitude=37.544,
                longitude=127.055,
            ),
            [("조각 피자 세트", 7000, True), ("마르게리타 피자 한 판", 17000, False)],
        ),
    ]

    for restaurant, items in rows:
        db.add(restaurant)
        db.flush()
        for name, price, is_main in items:
            db.add(
                RestaurantMenuItem(
                    restaurant_id=restaurant.id,
                    name=name,
                    price_krw=price,
                    is_main_menu=is_main,
                )
            )

    db.commit()
