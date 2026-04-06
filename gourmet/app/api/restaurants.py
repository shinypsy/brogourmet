from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.deps import get_admin_user, get_db
from app.models.restaurant import Restaurant, RestaurantMenuItem
from app.models.user import User
from app.schemas.restaurant import (
    MenuItemRead,
    RestaurantDetailRead,
    RestaurantListItem,
    RestaurantWrite,
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

MAX_MAIN_MENU_KRW = 10_000


def _main_item_for(restaurant: Restaurant) -> RestaurantMenuItem | None:
    mains = [m for m in restaurant.menu_items if m.is_main_menu]
    if not mains:
        return None
    return mains[0]


def _list_item_from(restaurant: Restaurant) -> dict:
    main = _main_item_for(restaurant)
    if main is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Restaurant has no main menu item",
        )
    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "city": restaurant.city,
        "district": restaurant.district,
        "category": restaurant.category,
        "summary": restaurant.summary,
        "image_url": restaurant.image_url,
        "latitude": restaurant.latitude,
        "longitude": restaurant.longitude,
        "main_menu_name": main.name,
        "main_menu_price": main.price_krw,
    }


def _detail_item_from(restaurant: Restaurant) -> RestaurantDetailRead:
    main = _main_item_for(restaurant)
    if main is None or main.price_krw > MAX_MAIN_MENU_KRW:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    items = sorted(restaurant.menu_items, key=lambda x: (not x.is_main_menu, x.id))
    return RestaurantDetailRead(
        id=restaurant.id,
        name=restaurant.name,
        city=restaurant.city,
        district=restaurant.district,
        category=restaurant.category,
        summary=restaurant.summary,
        image_url=restaurant.image_url,
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        created_at=restaurant.created_at,
        menu_items=[MenuItemRead.model_validate(m) for m in items],
    )


@router.get("", response_model=list[RestaurantListItem])
def list_restaurants(
    district: str | None = None,
    max_price: int = Query(default=10_000, ge=1, le=10_000),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
):
    cap = min(max_price, MAX_MAIN_MENU_KRW)
    q = (
        db.query(Restaurant)
        .join(RestaurantMenuItem)
        .filter(RestaurantMenuItem.is_main_menu.is_(True))
        .filter(RestaurantMenuItem.price_krw <= MAX_MAIN_MENU_KRW)
        .filter(RestaurantMenuItem.price_krw <= cap)
        .distinct()
        .options(selectinload(Restaurant.menu_items))
    )
    if district:
        q = q.filter(Restaurant.district == district)
    restaurants = q.order_by(Restaurant.name.asc()).all()
    if limit is not None:
        restaurants = restaurants[:limit]
    return [RestaurantListItem.model_validate(_list_item_from(r)) for r in restaurants]


@router.get("/{restaurant_id}", response_model=RestaurantDetailRead)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = (
        db.query(Restaurant)
        .options(selectinload(Restaurant.menu_items))
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    return _detail_item_from(restaurant)


@router.post("", response_model=RestaurantDetailRead, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    payload: RestaurantWrite,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    restaurant = Restaurant(
        name=payload.name,
        city=payload.city,
        district=payload.district,
        category=payload.category,
        summary=payload.summary,
        image_url=payload.image_url,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    restaurant.menu_items.append(
        RestaurantMenuItem(
            name=payload.main_menu_name,
            price_krw=payload.main_menu_price,
            is_main_menu=True,
        )
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    restaurant = (
        db.query(Restaurant)
        .options(selectinload(Restaurant.menu_items))
        .filter(Restaurant.id == restaurant.id)
        .first()
    )
    assert restaurant is not None
    return _detail_item_from(restaurant)


@router.put("/{restaurant_id}", response_model=RestaurantDetailRead)
def update_restaurant(
    restaurant_id: int,
    payload: RestaurantWrite,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    restaurant = (
        db.query(Restaurant)
        .options(selectinload(Restaurant.menu_items))
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    restaurant.name = payload.name
    restaurant.city = payload.city
    restaurant.district = payload.district
    restaurant.category = payload.category
    restaurant.summary = payload.summary
    restaurant.image_url = payload.image_url
    restaurant.latitude = payload.latitude
    restaurant.longitude = payload.longitude

    main = _main_item_for(restaurant)
    if main is None:
        main = RestaurantMenuItem(is_main_menu=True)
        restaurant.menu_items.append(main)
    main.name = payload.main_menu_name
    main.price_krw = payload.main_menu_price
    main.is_main_menu = True

    db.commit()
    db.refresh(restaurant)
    return _detail_item_from(restaurant)


@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    db.delete(restaurant)
    db.commit()
