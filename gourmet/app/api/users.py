from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.deps import get_current_user, get_db
from app.models.free_share_post import FreeSharePost
from app.models.known_restaurant_post import KnownRestaurantPost
from app.models.payment_intent import PaymentIntent
from app.models.restaurant import Restaurant
from app.models.restaurant_social import RestaurantComment, RestaurantLike
from app.models.user import User
from app.schemas.user import DeleteAccountRequest, UserRead
from app.services.user_read import build_user_read

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_user_read(db, current_user)


@router.post("/me/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """비밀번호 확인 후 사용자 및 연관 데이터 삭제(BroG 매장 본문은 유지, 제출자 FK만 NULL)."""
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호가 일치하지 않습니다.",
        )

    uid = current_user.id

    db.execute(delete(RestaurantComment).where(RestaurantComment.user_id == uid))
    db.execute(delete(RestaurantLike).where(RestaurantLike.user_id == uid))
    db.execute(delete(KnownRestaurantPost).where(KnownRestaurantPost.author_id == uid))
    db.execute(delete(FreeSharePost).where(FreeSharePost.author_id == uid))
    db.execute(delete(PaymentIntent).where(PaymentIntent.user_id == uid))

    db.execute(
        update(Restaurant)
        .where(Restaurant.submitted_by_user_id == uid)
        .values(submitted_by_user_id=None)
    )
    db.execute(
        update(Restaurant)
        .where(Restaurant.approved_by_user_id == uid)
        .values(approved_by_user_id=None)
    )

    db.delete(current_user)
    db.commit()
    return None
