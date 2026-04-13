"""ORM User → UserRead (담당 구 이름 포함)."""

from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.schemas.user import UserRead


def build_user_read(db: Session, user: User) -> UserRead:
    u = (
        db.query(User)
        .options(joinedload(User.managed_district))
        .filter(User.id == user.id)
        .first()
    )
    assert u is not None
    return UserRead(
        id=u.id,
        email=u.email,
        nickname=u.nickname,
        role=u.role,
        managed_district_id=u.managed_district_id,
        managed_district_name=u.managed_district.name if u.managed_district else None,
        email_verified_at=u.email_verified_at,
        is_active=u.is_active,
        points_balance=int(getattr(u, "points_balance", 0) or 0),
        created_at=u.created_at,
        updated_at=u.updated_at,
    )
