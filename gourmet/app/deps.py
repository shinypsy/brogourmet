from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.roles import REGIONAL_MANAGER, SUPER_ADMIN
from app.core.security import decode_token
from app.db import SessionLocal
from app.models.district import District
from app.models.restaurant import Restaurant
from app.models.site_event import SiteEvent
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


def get_site_event_editor(current_user: User = Depends(get_current_user)) -> User:
    """이벤트 등록·목록·비활성화·삭제: 슈퍼 또는 담당 구가 있는 지역 담당자."""
    if current_user.role == SUPER_ADMIN:
        return current_user
    if current_user.role == REGIONAL_MANAGER:
        if current_user.managed_district_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="담당 구가 지정된 지역 담당자만 이벤트를 관리할 수 있습니다.",
            )
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="이벤트 관리 권한이 없습니다.",
    )


def ensure_can_mutate_site_event(user: User, event: SiteEvent) -> None:
    """비활성화·삭제: 슈퍼는 전부, 지역 담당자는 본인이 등록한 이벤트만."""
    if user.role == SUPER_ADMIN:
        return
    if (
        user.role == REGIONAL_MANAGER
        and event.author_id is not None
        and event.author_id == user.id
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="이 이벤트를 변경할 권한이 없습니다.",
    )


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


def can_access_brog_manage(user: User, restaurant: Restaurant) -> bool:
    """BroG 관리 화면·수정·소프트 삭제 — 슈퍼, 담당 구 지역담당자, 또는 등록자 본인."""
    if user.role == SUPER_ADMIN:
        return True
    if user.role == REGIONAL_MANAGER:
        return user.managed_district_id is not None and user.managed_district_id == restaurant.district_id
    if restaurant.submitted_by_user_id is not None and restaurant.submitted_by_user_id == user.id:
        return True
    return False


def ensure_can_access_brog_manage(user: User, restaurant: Restaurant) -> None:
    if not can_access_brog_manage(user, restaurant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 BroG를 관리·수정할 권한이 없습니다.",
        )


def ensure_can_create_brog_in_chosen_district(user: User, district_id: int) -> None:
    """신규 등록: 지역 담당자는 담당 구만. 그 외 역할은 1단계 구 검증은 라우트에서 별도 처리."""
    if user.role == REGIONAL_MANAGER and user.managed_district_id != district_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="담당 구에만 BroG를 등록할 수 있습니다.",
        )


def can_moderate_community_post_district(
    user: User,
    post_district_name: str | None,
    db: Session,
) -> bool:
    """무료나눔·MyG 등 구 단위 게시글 수정(담당 구) — 슈퍼 또는 해당 구 지역담당자."""
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
            detail="글 수정은 최종 관리자 또는 해당 구 지역 담당자만 가능합니다.",
        )


def ensure_community_post_author_or_moderation(
    user: User,
    author_id: int,
    post_district_name: str | None,
    db: Session,
) -> None:
    """수정(PUT): 작성자 본인 또는 슈퍼/해당 구 지역 담당자."""
    if user.id == author_id:
        return
    ensure_community_post_moderation(user, post_district_name, db)


def ensure_community_post_super_admin_delete(user: User) -> None:
    """삭제(DELETE): 최종 관리자(super_admin)만."""
    if user.role != SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="글 삭제는 최종 관리자만 할 수 있습니다.",
        )
