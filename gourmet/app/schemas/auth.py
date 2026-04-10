from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=8, max_length=512)


class SignupResponse(BaseModel):
    user: UserRead
    email_verification_token: str | None = None


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ResendVerificationResponse(BaseModel):
    ok: bool = True
    email_verification_token: str | None = None


class RequestPasswordChangeCodeResponse(BaseModel):
    ok: bool = True
    dev_password_change_code: str | None = Field(
        default=None,
        description="로컬 개발용. DEV_RETURN_PASSWORD_CHANGE_CODE=1 일 때만 채워짐.",
    )


class ConfirmPasswordChangeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("code")
    @classmethod
    def normalize_six_digit_code(cls, v: str) -> str:
        s = v.strip().replace(" ", "").replace("-", "")
        if len(s) != 6 or not s.isdigit():
            raise ValueError("인증코드는 6자리 숫자여야 합니다.")
        return s
