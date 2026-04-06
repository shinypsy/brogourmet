from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.payment_intent import PaymentIntent
from app.models.user import User
from app.schemas.payment import PaymentIntentCreate, PaymentIntentRead

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/me", response_model=list[PaymentIntentRead])
def list_my_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intents = (
        db.query(PaymentIntent)
        .filter(PaymentIntent.user_id == current_user.id)
        .order_by(PaymentIntent.created_at.desc())
        .all()
    )
    return intents


@router.post("/intents", response_model=PaymentIntentRead, status_code=status.HTTP_201_CREATED)
def create_intent(
    payload: PaymentIntentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intent = PaymentIntent(
        user_id=current_user.id,
        amount_krw=payload.amount_krw,
        description=payload.description,
        status="pending",
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)
    return intent
