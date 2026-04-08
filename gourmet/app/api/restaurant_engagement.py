from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.roles import SUPER_ADMIN
from app.deps import can_manage_brog_in_district, get_current_user, get_current_user_optional, get_db
from app.models.restaurant import Restaurant
from app.models.restaurant_social import RestaurantComment, RestaurantLike
from app.models.user import User
from app.schemas.restaurant_engagement import (
    RestaurantCommentCreate,
    RestaurantCommentRead,
    RestaurantCommentUpdate,
    RestaurantEngagementRead,
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


def _published_restaurant_or_404(db: Session, restaurant_id: int) -> Restaurant:
    r = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not r or r.is_deleted or r.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    return r


@router.get("/{restaurant_id}/engagement", response_model=RestaurantEngagementRead)
def get_engagement(
    restaurant_id: int,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    _published_restaurant_or_404(db, restaurant_id)
    like_count = (
        db.query(func.count(RestaurantLike.id))
        .filter(RestaurantLike.restaurant_id == restaurant_id)
        .scalar()
        or 0
    )
    comment_count = (
        db.query(func.count(RestaurantComment.id))
        .filter(RestaurantComment.restaurant_id == restaurant_id)
        .scalar()
        or 0
    )
    liked_by_me = False
    if viewer is not None:
        liked_by_me = (
            db.query(RestaurantLike)
            .filter(
                RestaurantLike.restaurant_id == restaurant_id,
                RestaurantLike.user_id == viewer.id,
            )
            .first()
            is not None
        )
    return RestaurantEngagementRead(
        like_count=int(like_count),
        comment_count=int(comment_count),
        liked_by_me=liked_by_me,
    )


@router.get("/{restaurant_id}/comments", response_model=list[RestaurantCommentRead])
def list_comments(restaurant_id: int, db: Session = Depends(get_db)):
    _published_restaurant_or_404(db, restaurant_id)
    rows = (
        db.query(RestaurantComment)
        .options(joinedload(RestaurantComment.author))
        .filter(RestaurantComment.restaurant_id == restaurant_id)
        .order_by(RestaurantComment.created_at.asc())
        .all()
    )
    return [
        RestaurantCommentRead(
            id=c.id,
            body=c.body,
            user_id=c.user_id,
            author_nickname=c.author.nickname if c.author else "",
            created_at=c.created_at,
        )
        for c in rows
    ]


@router.post(
    "/{restaurant_id}/comments",
    response_model=RestaurantCommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    restaurant_id: int,
    payload: RestaurantCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _published_restaurant_or_404(db, restaurant_id)
    c = RestaurantComment(
        restaurant_id=restaurant_id,
        user_id=current_user.id,
        body=payload.body.strip(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    c = (
        db.query(RestaurantComment)
        .options(joinedload(RestaurantComment.author))
        .filter(RestaurantComment.id == c.id)
        .first()
    )
    assert c is not None
    return RestaurantCommentRead(
        id=c.id,
        body=c.body,
        user_id=c.user_id,
        author_nickname=c.author.nickname if c.author else "",
        created_at=c.created_at,
    )


@router.put(
    "/{restaurant_id}/comments/{comment_id}",
    response_model=RestaurantCommentRead,
)
def update_comment(
    restaurant_id: int,
    comment_id: int,
    payload: RestaurantCommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RestaurantCommentRead:
    r = _published_restaurant_or_404(db, restaurant_id)
    c = (
        db.query(RestaurantComment)
        .options(joinedload(RestaurantComment.author))
        .filter(
            RestaurantComment.id == comment_id,
            RestaurantComment.restaurant_id == restaurant_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if c.user_id != current_user.id and not can_manage_brog_in_district(current_user, r.district_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="댓글 수정은 본인 또는 최종 관리자·해당 구 담당자만 가능합니다.",
        )
    c.body = payload.body.strip()
    db.commit()
    db.refresh(c)
    c = (
        db.query(RestaurantComment)
        .options(joinedload(RestaurantComment.author))
        .filter(RestaurantComment.id == comment_id)
        .first()
    )
    assert c is not None
    return RestaurantCommentRead(
        id=c.id,
        body=c.body,
        user_id=c.user_id,
        author_nickname=c.author.nickname if c.author else "",
        created_at=c.created_at,
    )


@router.delete("/{restaurant_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    restaurant_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    r = _published_restaurant_or_404(db, restaurant_id)
    c = (
        db.query(RestaurantComment)
        .filter(
            RestaurantComment.id == comment_id,
            RestaurantComment.restaurant_id == restaurant_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if current_user.role != SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="댓글 삭제는 최종 관리자만 할 수 있습니다.",
        )
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{restaurant_id}/likes", status_code=status.HTTP_204_NO_CONTENT)
def add_like(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _published_restaurant_or_404(db, restaurant_id)
    exists = (
        db.query(RestaurantLike)
        .filter(
            RestaurantLike.restaurant_id == restaurant_id,
            RestaurantLike.user_id == current_user.id,
        )
        .first()
    )
    if not exists:
        db.add(RestaurantLike(restaurant_id=restaurant_id, user_id=current_user.id))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{restaurant_id}/likes", status_code=status.HTTP_204_NO_CONTENT)
def remove_like(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _published_restaurant_or_404(db, restaurant_id)
    row = (
        db.query(RestaurantLike)
        .filter(
            RestaurantLike.restaurant_id == restaurant_id,
            RestaurantLike.user_id == current_user.id,
        )
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
