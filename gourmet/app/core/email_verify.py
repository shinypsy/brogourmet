import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

_PEPPER = os.getenv("EMAIL_VERIFY_PEPPER") or os.getenv("JWT_SECRET_KEY", "change-this-in-production")
_TOKEN_BYTES = 32
_VALID_HOURS = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_HOURS", "48"))
_PASSWORD_CHANGE_MINUTES = int(os.getenv("PASSWORD_CHANGE_CODE_EXPIRE_MINUTES", "15"))


def generate_plain_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


def generate_password_change_code() -> str:
    """6자리 숫자(100000~999999) — 이메일 본문에 그대로 표시."""
    return f"{secrets.randbelow(900_000) + 100_000:06d}"


def hash_verification_token(plain: str) -> str:
    data = f"{_PEPPER}:{plain}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def verification_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=_VALID_HOURS)


def password_change_code_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=_PASSWORD_CHANGE_MINUTES)
