"""슈퍼 관리자(super_admin) 전용: 사용자·BroG 목록·지역 담당자 지정."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.roles import REGIONAL_MANAGER, SUPER_ADMIN
from app.api.site_notices import get_site_notices_read
from app.deps import get_db, get_super_admin_user
from app.models.district import District
from app.models.restaurant import Restaurant
from app.models.site_notice import SiteNotice, utc_now
from app.models.user import User
from app.schemas.admin import (
    AdminDistrictOption,
    AdminFranchisePinBody,
    AdminRestaurantRow,
    SetRegionalManagerBody,
)
from app.services.restaurant_franchise_display import effective_restaurant_is_franchise
from app.schemas.site_notice import SiteNoticeRead, SiteNoticesAdminPut
from app.schemas.user import UserRead
from app.services.user_read import build_user_read

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_restaurant_row(r: Restaurant) -> AdminRestaurantRow:
    dist = r.district
    sb_role = r.submitter.role if r.submitter is not None else None
    pin = getattr(r, "franchise_pin", None)
    return AdminRestaurantRow(
        id=r.id,
        name=r.name,
        district_id=r.district_id,
        district_name=dist.name if dist else "",
        category=r.category,
        status=r.status,
        bro_list_pin=r.bro_list_pin,
        is_deleted=bool(r.is_deleted),
        is_franchise=effective_restaurant_is_franchise(pin, sb_role),
        franchise_pin=pin,
    )


@router.get("/districts", response_model=list[AdminDistrictOption])
def list_districts_admin(
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """공개 `/districts`와 달리 stage1 필터 없이 활성 구 전체(선정 드롭다운용)."""
    return (
        db.query(District)
        .filter(District.active.is_(True))
        .order_by(District.sort_order.asc(), District.name.asc())
        .all()
    )


@router.get("/users", response_model=list[UserRead])
def list_users_admin(
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.id.asc()).all()
    return [build_user_read(db, u) for u in users]


@router.post("/users/{user_id}/set-regional-manager", response_model=UserRead)
def set_regional_manager(
    user_id: int,
    body: SetRegionalManagerBody,
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == user_id).first()
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if u.role == SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="최종 관리자 계정에는 지역 담당자 구를 지정할 수 없습니다.",
        )
    d = db.query(District).filter(District.id == body.district_id, District.active.is_(True)).first()
    if d is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효한 구를 선택하세요.")

    u.role = REGIONAL_MANAGER
    u.managed_district_id = d.id
    db.add(u)
    db.commit()
    db.refresh(u)
    return build_user_read(db, u)


@router.post("/users/{user_id}/clear-regional-manager", response_model=UserRead)
def clear_regional_manager(
    user_id: int,
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == user_id).first()
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if u.role == SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="최종 관리자 계정은 이 API 대상이 아닙니다.",
        )
    if u.role != REGIONAL_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지역 담당자가 아닌 사용자입니다.",
        )
    u.role = "user"
    u.managed_district_id = None
    db.add(u)
    db.commit()
    db.refresh(u)
    return build_user_read(db, u)


@router.get("/restaurants", response_model=list[AdminRestaurantRow])
def list_restaurants_admin(
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    """BroG 전체(초안·숨김 포함). 구별 정렬 후 같은 구 안에서 노출 우선, 음식점명 내림차순."""
    rows = (
        db.query(Restaurant)
        .options(joinedload(Restaurant.district), joinedload(Restaurant.submitter))
        .join(District, Restaurant.district_id == District.id)
        .order_by(
            District.sort_order.asc(),
            District.name.asc(),
            Restaurant.is_deleted.asc(),
            Restaurant.name.desc(),
        )
        .all()
    )
    return [_admin_restaurant_row(r) for r in rows]


@router.patch("/restaurants/{restaurant_id}/franchise-pin", response_model=AdminRestaurantRow)
def patch_restaurant_franchise_pin(
    restaurant_id: int,
    body: AdminFranchisePinBody,
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    r = (
        db.query(Restaurant)
        .options(joinedload(Restaurant.district), joinedload(Restaurant.submitter))
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    r.franchise_pin = body.franchise_pin
    db.add(r)
    db.commit()
    db.refresh(r)
    r = (
        db.query(Restaurant)
        .options(joinedload(Restaurant.district), joinedload(Restaurant.submitter))
        .filter(Restaurant.id == restaurant_id)
        .first()
    )
    assert r is not None
    return _admin_restaurant_row(r)


@router.get("/site-notices", response_model=list[SiteNoticeRead])
def admin_get_site_notices(
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    return get_site_notices_read(db)


@router.put("/site-notices", response_model=list[SiteNoticeRead])
def admin_put_site_notices(
    body: SiteNoticesAdminPut,
    _: User = Depends(get_super_admin_user),
    db: Session = Depends(get_db),
):
    for item in body.items:
        row = db.get(SiteNotice, item.slot)
        if row is None:
            row = SiteNotice(slot=item.slot, title=item.title, body=item.body)
            db.add(row)
        else:
            row.title = item.title
            row.body = item.body
        row.updated_at = utc_now()
    db.commit()
    return get_site_notices_read(db)
