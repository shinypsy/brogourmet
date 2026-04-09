import logging
import os

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.email_verify import (
    generate_plain_token,
    hash_verification_token,
    verification_expires_at,
)
from app.core.security import create_access_token, get_password_hash, verify_password
from app.deps import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    SignupResponse,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.user import UserCreate, UserRead
from app.services.user_read import build_user_read
from app.services.verification_smtp import (
    VerificationEmailNotConfigured,
    deliver_verification_email,
    send_verification_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _require_verification_email_on_signup() -> bool:
    return os.getenv("REQUIRE_VERIFICATION_EMAIL_ON_SIGNUP", "").lower() in ("1", "true", "yes")


def _dev_return_verification_plain() -> bool:
    return os.getenv("DEV_RETURN_EMAIL_VERIFICATION_TOKEN", "").lower() in ("1", "true", "yes")


def _login_requires_verified_email() -> bool:
    return os.getenv("REQUIRE_EMAIL_VERIFIED_FOR_LOGIN", "").lower() in ("1", "true", "yes")


def _set_verification_token_on_user(user: User) -> str:
    plain = generate_plain_token()
    user.email_verification_token_hash = hash_verification_token(plain)
    user.email_verification_expires_at = verification_expires_at()
    return plain


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        nickname=payload.nickname,
    )
    plain = _set_verification_token_on_user(user)
    db.add(user)
    require_mail = _require_verification_email_on_signup()
    try:
        if require_mail:
            db.flush()
            deliver_verification_email(user.email, plain, user.nickname)
        db.commit()
    except VerificationEmailNotConfigured:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "회원가입을 처리할 수 없습니다. gourmet .env 에 SMTP_ENABLED=true 및 "
                "SMTP_USER, SMTP_PASSWORD(Gmail 은 앱 비밀번호)를 설정하세요."
            ),
        )
    except Exception:
        if require_mail:
            db.rollback()
            logger.exception("가입 중 인증 메일 발송 실패: email=%s", payload.email)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
            )
        raise

    db.refresh(user)

    # BackgroundTasks 는 응답 직후 실행이라 일부 환경에서 가입 직후 메일이 빠지는 경우가 있어,
    # require_mail=false 일 때도 동일하게 요청 안에서 발송 시도(실패는 send_verification_email 이 로그 처리).
    if not require_mail:
        send_verification_email(user.email, plain, user.nickname)

    return SignupResponse(
        user=build_user_read(db, user),
        email_verification_token=plain if _dev_return_verification_plain() else None,
    )


@router.post("/verify-email", response_model=UserRead, status_code=status.HTTP_200_OK)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    token = payload.token.strip()
    token_hash = hash_verification_token(token)
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )
    now = datetime.now(timezone.utc)
    if user.email_verification_expires_at is not None and user.email_verification_expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link expired",
        )

    user.email_verified_at = now
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    db.refresh(user)
    return build_user_read(db, user)


@router.post("/resend-verification", response_model=ResendVerificationResponse)
def resend_verification(
    payload: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    """계정 존재 여부를 숨기기 위해 항상 ok. 실제로는 미인증 계정에만 새 토큰을 저장합니다."""
    user = db.query(User).filter(User.email == payload.email).first()
    plain: str | None = None
    if user is not None and user.email_verified_at is None:
        plain = _set_verification_token_on_user(user)
        db.commit()
        db.refresh(user)
        if plain:
            send_verification_email(user.email, plain, user.nickname)

    return ResendVerificationResponse(
        ok=True,
        email_verification_token=plain if plain and _dev_return_verification_plain() else None,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if _login_requires_verified_email() and user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이메일 인증이 완료되지 않았습니다. /verify-email 에서 인증한 뒤 다시 로그인하세요.",
        )

    access_token = create_access_token(subject=user.email)
    return TokenResponse(access_token=access_token)
