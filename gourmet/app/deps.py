from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.roles import REGIONAL_MANAGER, SUPER_ADMIN
from app.core.security import decode_token
from app.db import SessionLocal
from app.models.district import District
from app.models.user import User

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is missing",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        return None
    email = payload.get("sub")
    if not email:
        return None
    return db.query(User).filter(User.email == email).first()


def get_super_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user


def can_manage_brog_in_district(user: User, district_id: int) -> bool:
    if user.role == SUPER_ADMIN:
        return True
    if user.role == REGIONAL_MANAGER:
        return user.managed_district_id is not None and user.managed_district_id == district_id
    return False


def ensure_brog_district_access(user: User, district_id: int) -> None:
    if not can_manage_brog_in_district(user, district_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to manage BroG in this district",
        )


def can_moderate_community_post_district(
    user: User,
    post_district_name: str | None,
    db: Session,
) -> bool:
    """무료나눔·MyG 등 구 단위 게시글 수정·삭제 — 슈퍼 또는 해당 구 지역담당자만."""
    if user.role == SUPER_ADMIN:
        return True
    if user.role != REGIONAL_MANAGER or user.managed_district_id is None:
        return False
    name = (post_district_name or "").strip()
    if not name:
        return False
    d = db.query(District).filter(District.id == user.managed_district_id).first()
    if not d:
        return False
    return d.name.strip() == name


def ensure_community_post_moderation(
    user: User,
    post_district_name: str | None,
    db: Session,
) -> None:
    if not can_moderate_community_post_district(user, post_district_name, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="글 수정·삭제는 최종 관리자 또는 해당 구 지역 담당자만 가능합니다.",
        )


def ensure_community_post_author_or_moderation(
    user: User,
    author_id: int,
    post_district_name: str | None,
    db: Session,
) -> None:
    """작성자 본인 또는 슈퍼/해당 구 지역 담당자만 수정·삭제."""
    if user.id == author_id:
        return
    ensure_community_post_moderation(user, post_district_name, db)
