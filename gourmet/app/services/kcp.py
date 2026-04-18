"""NHN KCP 표준결제 — 모바일 거래등록 + 서버 승인(문서: developer.kcp.co.kr 표준결제).

비밀(kcp_cert_info 등)은 환경변수·서버 파일에만 둔다. Ret_URL 은 KCP 서버가 호출 가능한 공개 URL이어야 함(로컬만으로는 실콜백 불가 시 ngrok 등).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 문서 기본 테스트 URL
DEFAULT_REGISTER_URL = "https://testsmpay.kcp.co.kr/trade/register.do"
DEFAULT_PAYMENT_URL = "https://stg-spl.kcp.co.kr/gw/enc/v1/payment"
LIVE_REGISTER_URL = "https://smpay.kcp.co.kr/trade/register.do"
LIVE_PAYMENT_URL = "https://spl.kcp.co.kr/gw/enc/v1/payment"


@dataclass(frozen=True)
class KcpSettings:
    site_cd: str
    cert_info: str | None  # 승인 API에 필요. 거래등록만 테스트할 때는 비울 수 있음.
    register_url: str
    payment_url: str
    return_url: str
    shop_name: str


def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes")


def _load_cert_text() -> str | None:
    cert = (os.environ.get("KCP_CERT_INFO") or "").strip()
    if cert:
        return cert.replace("\\n", "\n")
    path = (os.environ.get("KCP_CERT_INFO_PATH") or "").strip()
    if path and os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    return None


def load_kcp_settings(*, require_cert: bool = False) -> KcpSettings | None:
    site_cd = (os.environ.get("KCP_SITE_CD") or "").strip()
    if not site_cd:
        return None
    ret = (os.environ.get("BROG_KCP_RETURN_URL") or "").strip()
    if not ret:
        logger.warning("KCP_SITE_CD is set but BROG_KCP_RETURN_URL is missing (KCP Ret_URL).")
        return None
    cert = _load_cert_text()
    if require_cert and not cert:
        logger.warning("KCP 승인에 필요한 KCP_CERT_INFO (또는 KCP_CERT_INFO_PATH)가 없습니다.")
        return None
    if _env_truthy("KCP_LIVE"):
        reg_url = (os.environ.get("KCP_REGISTER_URL") or "").strip() or LIVE_REGISTER_URL
        pay_url = (os.environ.get("KCP_PAYMENT_URL") or "").strip() or LIVE_PAYMENT_URL
    else:
        reg_url = (os.environ.get("KCP_REGISTER_URL") or "").strip() or DEFAULT_REGISTER_URL
        pay_url = (os.environ.get("KCP_PAYMENT_URL") or "").strip() or DEFAULT_PAYMENT_URL
    shop = (os.environ.get("KCP_SHOP_NAME") or "BroGourmet").strip() or "BroGourmet"
    return KcpSettings(
        site_cd=site_cd,
        cert_info=cert,
        register_url=reg_url,
        payment_url=pay_url,
        return_url=ret,
        shop_name=shop[:40],
    )


def encoding_filter_action_url(pay_url: str) -> str:
    """모바일 결제창: PayUrl 기준 encodingFilter.jsp (문서 4.1)."""
    base = pay_url.rsplit("/", 1)[0]
    return f"{base}/jsp/encodingFilter/encodingFilter.jsp"


def trade_register(
    *,
    ordr_idxx: str,
    good_mny: str,
    good_name: str,
    pay_method: str,
    ret_url: str,
    site_cd: str,
    register_url: str,
    user_agent: str = "BroGourmet-API",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "site_cd": site_cd,
        "ordr_idxx": ordr_idxx,
        "good_mny": good_mny,
        "good_name": good_name[:40],
        "pay_method": pay_method,
        "Ret_URL": ret_url,
        "user_agent": user_agent[:40],
    }
    if extra:
        payload.update({k: v for k, v in extra.items() if v is not None})
    with httpx.Client(timeout=45.0) as client:
        response = client.post(register_url, json=payload)
        response.raise_for_status()
        try:
            return response.json()
        except json.JSONDecodeError as exc:
            logger.error("KCP register non-JSON: %s", response.text[:500])
            raise RuntimeError("KCP 거래등록 응답이 JSON이 아닙니다.") from exc


def request_payment_approval(
    *,
    site_cd: str,
    cert_info: str,
    enc_data: str,
    enc_info: str,
    tran_cd: str,
    ordr_no: str,
    ordr_mony: str,
    pay_type: str,
    payment_url: str,
) -> dict[str, Any]:
    body = {
        "tran_cd": tran_cd,
        "kcp_cert_info": cert_info,
        "site_cd": site_cd,
        "enc_data": enc_data,
        "enc_info": enc_info,
        "ordr_mony": ordr_mony,
        "pay_type": pay_type,
        "ordr_no": ordr_no,
    }
    with httpx.Client(timeout=45.0) as client:
        response = client.post(
            payment_url,
            content=json.dumps(body, ensure_ascii=False),
            headers={"Content-Type": "application/json; charset=UTF-8"},
        )
        response.raise_for_status()
        try:
            return response.json()
        except json.JSONDecodeError as exc:
            logger.error("KCP payment non-JSON: %s", response.text[:500])
            raise RuntimeError("KCP 승인 응답이 JSON이 아닙니다.") from exc
