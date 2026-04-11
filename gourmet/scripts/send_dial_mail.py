"""
dial/일일 로그 .txt (KST 당일 dial_YYYY-MM-dd.txt 기본, 환경변수 BROG_DIAL_MAIL_FILE 로 덮어쓰기)
및 선택 IP_dial.txt 를 gourmet/.env 의 SMTP 설정으로 발송.
가입 인증 메일과 동일하게 SMTP_USER + 앱 비밀번호로 로그인한다.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv

GOURMET = Path(__file__).resolve().parent.parent
REPO = GOURMET.parent

sys.path.insert(0, str(GOURMET))
load_dotenv(GOURMET / ".env")

from app.services.verification_smtp import (  # noqa: E402
    VerificationEmailNotConfigured,
    _load_smtp_config,
    _smtp_send_message,
)

DIAL_RECIPIENTS = ("shinypsy@naver.com", "shinypsy@gmail.com")


def _dial_mail_filename() -> str:
    env = os.environ.get("BROG_DIAL_MAIL_FILE", "").strip()
    if env:
        return env
    kst = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")
    return f"dial_{kst}.txt"


def main() -> int:
    dial_mail_file = _dial_mail_filename()
    dial_path = REPO / "dial" / dial_mail_file
    if not dial_path.is_file():
        print(f"dial/{dial_mail_file} not found")
        return 1

    try:
        cfg = _load_smtp_config()
    except Exception as e:
        print("FAIL:", e)
        return 1

    if not cfg.user or not cfg.password:
        print("FAIL: gourmet/.env 에 SMTP_USER, SMTP_PASSWORD 가 필요합니다 (Gmail 은 앱 비밀번호).")
        return 1

    ip_path = REPO / "IP_dial.txt"
    send_ip = ip_path.is_file()

    today = datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
    body = f"BroGourmet {today} dial log attached."
    if send_ip:
        body += " IP_dial.txt also attached (will be deleted after send)."

    msg = MIMEMultipart()
    msg["Subject"] = f"[BroGourmet] {today} dial"
    msg["From"] = cfg.mail_from
    msg["To"] = ", ".join(DIAL_RECIPIENTS)
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with open(dial_path, "rb") as f:
        dial_raw = f.read()
    dial_part = MIMEBase("application", "octet-stream")
    dial_part.set_payload(dial_raw)
    encoders.encode_base64(dial_part)
    dial_part.add_header("Content-Disposition", "attachment", filename=dial_mail_file)
    msg.attach(dial_part)

    if send_ip:
        with open(ip_path, "rb") as f:
            raw = f.read()
        part = MIMEBase("application", "octet-stream")
        part.set_payload(raw)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename="IP_dial.txt")
        msg.attach(part)

    try:
        _smtp_send_message(msg, cfg)
    except VerificationEmailNotConfigured as e:
        print("FAIL:", e)
        return 1
    except OSError as e:
        print("FAIL:", e)
        return 1
    except Exception as e:
        print("FAIL:", e)
        return 1

    if send_ip:
        try:
            ip_path.unlink()
            print("IP_dial.txt deleted")
        except OSError as e:
            print("WARN: could not delete IP_dial.txt:", e)

    print("OK - mail sent to", ", ".join(DIAL_RECIPIENTS))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
