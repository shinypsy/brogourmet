#!/usr/bin/env python3
"""
CLOVA General OCR 단독 점검 (서버 코드 없이 .env 만으로 호출).

  cd d:\brogourmet\gourmet
  .\.venv\Scripts\Activate.ps1
  pip install httpx python-dotenv
  python scripts\test_clova_ocr.py path\to\menu.png

필수 환경변수: CLOVA_OCR_INVOKE_URL, CLOVA_OCR_SECRET_KEY (.env 로드)
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from uuid import uuid4

def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv

        root = Path(__file__).resolve().parents[1]
        load_dotenv(root / ".env")
    except ImportError:
        pass


def main() -> int:
    _load_dotenv()
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_clova_ocr.py <image.jpg|png>")
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print("File not found:", path)
        return 2
    url = (os.getenv("CLOVA_OCR_INVOKE_URL") or "").strip()
    secret = (os.getenv("CLOVA_OCR_SECRET_KEY") or "").strip()
    if not url or not secret:
        print("Set CLOVA_OCR_INVOKE_URL and CLOVA_OCR_SECRET_KEY in gourmet/.env")
        return 2

    suffix = path.suffix.lower()
    fmt = "jpg" if suffix in (".jpg", ".jpeg") else "png" if suffix == ".png" else None
    if not fmt:
        print("Use .jpg, .jpeg, or .png")
        return 2

    message = {
        "version": "V2",
        "requestId": str(uuid4()),
        "timestamp": int(time.time() * 1000),
        "lang": "ko",
        "images": [{"format": fmt, "name": path.stem}],
        "enableTableDetection": True,
    }
    raw = path.read_bytes()
    mime = "image/jpeg" if fmt == "jpg" else "image/png"

    import httpx

    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            url,
            headers={"X-OCR-SECRET": secret},
            data={"message": json.dumps(message, ensure_ascii=False)},
            files={"file": (path.name, raw, mime)},
        )
    print("HTTP", r.status_code)
    if r.status_code >= 400:
        print(r.text[:2000])
        return 1
    body = r.json()
    # 간단 출력: fields inferText만 이어 붙이기
    lines: list[str] = []
    for img in body.get("images") or []:
        for f in img.get("fields") or []:
            t = f.get("inferText")
            if t:
                lines.append(str(t))
            if f.get("lineBreak"):
                lines.append("\n")
    print("--- raw fields join ---")
    print("".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
