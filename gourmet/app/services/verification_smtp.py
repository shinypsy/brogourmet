"""가입·재발급 시 이메일 인증 링크 발송 (SMTP, stdlib)."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class VerificationEmailNotConfigured(Exception):
    """SMTP_ENABLED 가 꺼졌거나 SMTP_USER / SMTP_PASSWORD 가 없음."""


def smtp_sending_enabled() -> bool:
    return os.getenv("SMTP_ENABLED", "").lower() in ("1", "true", "yes")


@dataclass(frozen=True)
class _SmtpConfig:
    host: str
    port: int
    user: str
    password: str
    mail_from: str
    base_url: str
    use_ssl: bool
    starttls: bool


def _load_smtp_config() -> _SmtpConfig:
    return _SmtpConfig(
        host=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        port=int(os.getenv("SMTP_PORT", "587")),
        user=os.getenv("SMTP_USER", "").strip(),
        password=os.getenv("SMTP_PASSWORD", ""),
        mail_from=os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "").strip()).strip(),
        base_url=os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173").rstrip("/"),
        use_ssl=os.getenv("SMTP_USE_SSL", "").lower() in ("1", "true", "yes"),
        starttls=os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes"),
    )


def _build_verification_mime(
    to_address: str,
    plain_token: str,
    nickname: str | None,
    cfg: _SmtpConfig,
) -> MIMEMultipart:
    verify_url = f"{cfg.base_url}/verify-email?token={quote(plain_token, safe='')}"
    greeting = f"안녕하세요, {nickname} 님." if nickname else "안녕하세요."
    subject = "[BroGourmet] 이메일 인증"

    text_body = f"""{greeting}

아래 링크를 눌러 이메일 인증을 완료해 주세요.
{verify_url}

링크가 열리지 않으면 위 URL 전체를 복사해 브라우저 주소창에 붙여 넣으세요.
"""

    html_body = f"""<p>{greeting}</p>
<p><a href="{verify_url}">이메일 인증하기</a></p>
<p>또는 아래 URL을 복사하세요.</p>
<p style="word-break:break-all;font-size:0.9em;">{verify_url}</p>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg.mail_from
    msg["To"] = to_address
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


def _smtp_send_message(msg: MIMEMultipart, cfg: _SmtpConfig) -> None:
    if cfg.use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(cfg.host, cfg.port, context=context) as server:
            server.login(cfg.user, cfg.password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(cfg.host, cfg.port) as server:
            server.ehlo()
            if cfg.starttls:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            server.login(cfg.user, cfg.password)
            server.send_message(msg)


def deliver_verification_email(to_address: str, plain_token: str, nickname: str | None = None) -> None:
    """SMTP 로 즉시 발송. 설정 불가·SMTP 오류 시 예외(가입 롤백용)."""
    if not smtp_sending_enabled():
        raise VerificationEmailNotConfigured("SMTP_ENABLED 가 켜져 있지 않습니다.")

    cfg = _load_smtp_config()
    if not cfg.user or not cfg.password:
        raise VerificationEmailNotConfigured(
            "SMTP_USER 또는 SMTP_PASSWORD 가 비어 있습니다. Gmail 은 앱 비밀번호를 사용하세요."
        )

    msg = _build_verification_mime(to_address, plain_token, nickname, cfg)
    _smtp_send_message(msg, cfg)


def send_verification_email(to_address: str, plain_token: str, nickname: str | None = None) -> None:
    """백그라운드 태스크용: 설정·발송 실패 시 로그만(기본)."""
    try:
        deliver_verification_email(to_address, plain_token, nickname)
    except VerificationEmailNotConfigured:
        logger.info(
            "인증 메일 미발송(to=%s): gourmet .env 에 SMTP_ENABLED=true 및 SMTP_USER/SMTP_PASSWORD 를 설정하세요. "
            "로컬 개발은 DEV_RETURN_EMAIL_VERIFICATION_TOKEN=true 로 가입 응답에 토큰을 받을 수 있습니다.",
            to_address,
        )
    except Exception:
        logger.exception("인증 메일 발송 실패: to=%s", to_address)
        if os.getenv("SMTP_FAIL_RAISES", "").lower() in ("1", "true", "yes"):
            raise
