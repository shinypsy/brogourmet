"""가입·재발급 시 이메일 인증 링크 발송 (SMTP, stdlib)."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def smtp_sending_enabled() -> bool:
    return os.getenv("SMTP_ENABLED", "").lower() in ("1", "true", "yes")


def send_verification_email(to_address: str, plain_token: str, nickname: str | None = None) -> None:
    if not smtp_sending_enabled():
        return

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    mail_from = os.getenv("SMTP_FROM", user).strip()
    base = os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173").rstrip("/")

    if not user or not password:
        logger.warning("SMTP_ENABLED 이지만 SMTP_USER 또는 SMTP_PASSWORD 가 비어 있어 발송을 건너뜁니다.")
        return

    verify_url = f"{base}/verify-email?token={quote(plain_token, safe='')}"
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
    msg["From"] = mail_from
    msg["To"] = to_address
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    use_ssl = os.getenv("SMTP_USE_SSL", "").lower() in ("1", "true", "yes")
    starttls = os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes")

    try:
        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port) as server:
                server.ehlo()
                if starttls:
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                server.login(user, password)
                server.send_message(msg)
    except Exception:
        logger.exception("인증 메일 발송 실패: to=%s", to_address)
        if os.getenv("SMTP_FAIL_RAISES", "").lower() in ("1", "true", "yes"):
            raise
