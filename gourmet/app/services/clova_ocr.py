"""네이버 클라우드 플랫폼 CLOVA OCR (General) 호출. 키·URL은 서버 환경변수만 사용."""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from uuid import uuid4

import httpx

logger = logging.getLogger(__name__)


def clova_ocr_configured() -> bool:
    url = (os.getenv("CLOVA_OCR_INVOKE_URL") or "").strip()
    secret = (os.getenv("CLOVA_OCR_SECRET_KEY") or "").strip()
    return bool(url and secret)


def _format_from_filename(name: str, content_type: str | None) -> str | None:
    suffix = Path(name or "").suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        return "jpg"
    if suffix == ".png":
        return "png"
    if content_type == "image/jpeg":
        return "jpg"
    if content_type == "image/png":
        return "png"
    return None


def _join_fields_lines(fields: list[dict]) -> str:
    buf: list[str] = []
    lines_out: list[str] = []
    for f in fields:
        t = f.get("inferText")
        if t is not None:
            buf.append(str(t))
        if f.get("lineBreak"):
            lines_out.append("".join(buf).strip())
            buf = []
    if buf:
        lines_out.append("".join(buf).strip())
    return "\n".join(ln for ln in lines_out if ln)


def _extract_tables_text(tables: list[dict]) -> str:
    parts: list[str] = []

    def walk_cell_words(obj: dict) -> None:
        for w in obj.get("cellWords") or []:
            t = w.get("inferText")
            if t:
                parts.append(str(t))

    for tb in tables:
        for cell in tb.get("cells") or []:
            for line in cell.get("cellTextLines") or []:
                walk_cell_words(line)
    return "\n".join(parts)


def text_from_clova_response(body: dict) -> str:
    chunks: list[str] = []
    for img in body.get("images") or []:
        if img.get("inferResult") not in ("SUCCESS", None):
            msg = img.get("message") or img.get("inferResult")
            logger.warning("CLOVA image infer not success: %s", msg)
        combine = img.get("combineResult") or {}
        ct = combine.get("text")
        if isinstance(ct, str) and ct.strip():
            chunks.append(ct.strip())
            continue
        fields = img.get("fields") or []
        if fields:
            chunks.append(_join_fields_lines(fields))
        tables = img.get("tables") or []
        if tables:
            tt = _extract_tables_text(tables)
            if tt.strip():
                chunks.append(tt.strip())
    return "\n\n".join(c for c in chunks if c)


async def call_clova_general_ocr(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str | None,
) -> str:
    if not clova_ocr_configured():
        raise RuntimeError("CLOVA OCR is not configured (CLOVA_OCR_INVOKE_URL, CLOVA_OCR_SECRET_KEY)")

    fmt = _format_from_filename(filename, content_type)
    if not fmt:
        raise ValueError("CLOVA General OCR supports jpeg/jpg/png for this endpoint. Use PNG or JPEG.")

    url = os.getenv("CLOVA_OCR_INVOKE_URL", "").strip()
    secret = os.getenv("CLOVA_OCR_SECRET_KEY", "").strip()

    message = {
        "version": "V2",
        "requestId": str(uuid4()),
        "timestamp": int(time.time() * 1000),
        "lang": "ko",
        "images": [{"format": fmt, "name": "menu"}],
        "enableTableDetection": True,
    }

    mime = content_type if content_type in ("image/jpeg", "image/png") else (
        "image/jpeg" if fmt == "jpg" else "image/png"
    )
    safe_name = Path(filename or "menu.jpg").name or "menu.jpg"

    timeout = float(os.getenv("CLOVA_OCR_TIMEOUT_SECONDS", "90"))

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            headers={"X-OCR-SECRET": secret},
            data={"message": json.dumps(message, ensure_ascii=False)},
            files={"file": (safe_name, file_bytes, mime)},
        )

    if response.status_code >= 400:
        logger.warning("CLOVA HTTP %s: %s", response.status_code, response.text[:500])
        raise RuntimeError(f"CLOVA OCR request failed ({response.status_code})")

    body = response.json()
    text = text_from_clova_response(body)
    if not text.strip():
        raise RuntimeError("CLOVA OCR returned no text")
    return text
