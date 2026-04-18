"""NHN KCP 모바일 거래등록 + Ret_URL 폼 + 서버 승인."""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.payment_intent import PaymentIntent
from app.models.user import User
from app.schemas.payment import PaymentIntentRead
from app.services.kcp import (
    encoding_filter_action_url,
    load_kcp_settings,
    request_payment_approval,
    trade_register,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments-kcp"])


def _frontend_base() -> str:
    return (os.environ.get("FRONTEND_PUBLIC_URL") or "http://localhost:5173").rstrip("/")


def _pay_type_default() -> str:
    return (os.environ.get("KCP_PAY_TYPE") or "PACA").strip() or "PACA"


def _kcp_register_ok(data: dict[str, Any]) -> bool:
    code = data.get("Code") or data.get("code")
    return str(code) == "0000"


def _kcp_payment_ok(data: dict[str, Any]) -> bool:
    code = data.get("res_cd") or data.get("resCd")
    return str(code) == "0000"


class KcpRegisterBody(BaseModel):
    amount_krw: int = Field(ge=100, le=10_000_000)
    description: str | None = Field(default=None, max_length=500)
    good_name: str | None = Field(default=None, max_length=40)
    pay_method: str = Field(default="CARD", max_length=8)
    intent_kind: Literal["merchant", "point_charge"] = "merchant"

    @model_validator(mode="after")
    def validate_point_charge(self) -> KcpRegisterBody:
        if self.intent_kind == "point_charge":
            if self.amount_krw < 10_000 or self.amount_krw % 10_000 != 0:
                raise ValueError("포인트 충전은 1만 원 단위(10,000원 이상)로만 가능합니다.")
        return self


@router.post("/kcp/register", status_code=status.HTTP_201_CREATED)
def kcp_register_payment(
    body: KcpRegisterBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    cfg = load_kcp_settings(require_cert=False)
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "KCP 미설정: KCP_SITE_CD, BROG_KCP_RETURN_URL(공개 HTTPS 권장) 필요. "
                "승인까지 하려면 KCP_CERT_INFO 또는 KCP_CERT_INFO_PATH."
            ),
        )

    if body.intent_kind == "point_charge":
        good_label = (body.good_name or body.description or "포인트 충전").strip() or "포인트 충전"
    else:
        good_label = (body.good_name or body.description or "BroGourmet").strip() or "BroGourmet"
    nick = (current_user.nickname or "").strip()

    intent = PaymentIntent(
        user_id=current_user.id,
        amount_krw=body.amount_krw,
        description=body.description,
        status="pending",
        intent_kind=body.intent_kind,
        merchant_order_id=None,
        paid_at=None,
        pg_extra=None,
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)

    ordr_idxx = f"BG{intent.id:08d}{secrets.token_hex(4).upper()}"
    if len(ordr_idxx) > 70:
        ordr_idxx = ordr_idxx[:70]

    extra: dict[str, Any] = {}
    if nick:
        extra["buyr_name"] = nick[:30]

    try:
        reg = trade_register(
            ordr_idxx=ordr_idxx,
            good_mny=str(body.amount_krw),
            good_name=good_label,
            pay_method=body.pay_method,
            ret_url=cfg.return_url,
            site_cd=cfg.site_cd,
            register_url=cfg.register_url,
            extra=extra or None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("KCP trade_register failed")
        db.delete(intent)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"KCP 거래등록 실패: {exc!s}",
        ) from exc

    if not _kcp_register_ok(reg):
        db.delete(intent)
        db.commit()
        msg = reg.get("Message") or reg.get("message") or str(reg)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"KCP 거래등록 거절: {msg}",
        )

    pay_url = reg.get("PayUrl") or reg.get("pay_url")
    if not pay_url:
        db.delete(intent)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="KCP 응답에 PayUrl이 없습니다.",
        )

    intent.merchant_order_id = ordr_idxx
    intent.pg_extra = {
        "kcp_register": reg,
        "encoding_submit_url": encoding_filter_action_url(str(pay_url)),
    }
    db.add(intent)
    db.commit()
    db.refresh(intent)

    mobile_fields: dict[str, Any] = {
        "site_cd": reg.get("site_cd", cfg.site_cd),
        "pay_method": reg.get("pay_method", body.pay_method),
        "currency": reg.get("currency", "410"),
        "shop_name": reg.get("shop_name", cfg.shop_name),
        "Ret_URL": reg.get("Ret_URL", cfg.return_url),
        "approval_key": reg.get("approval_key"),
        "PayUrl": pay_url,
        "ordr_idxx": reg.get("ordr_idxx", ordr_idxx),
        "good_name": reg.get("good_name", good_label[:40]),
        "good_cd": reg.get("good_cd", "00"),
        "good_mny": reg.get("good_mny", str(body.amount_krw)),
    }
    if nick:
        mobile_fields["buyr_name"] = nick[:30]

    return {
        "intent": PaymentIntentRead.model_validate(intent),
        "kcp": {
            "encoding_submit_url": intent.pg_extra.get("encoding_submit_url"),
            "mobile_form": mobile_fields,
        },
    }


@router.post("/kcp/return")
def kcp_return_after_auth(
    db: Session = Depends(get_db),
    res_cd: str = Form(""),
    res_msg: str = Form(""),
    tran_cd: str = Form(""),
    enc_data: str = Form(""),
    enc_info: str = Form(""),
    ordr_idxx: str = Form(""),
    good_mny: str = Form(""),
) -> RedirectResponse:
    """KCP Ret_URL — 브라우저 폼 POST. 승인 후 프론트로 리다이렉트."""
    base = _frontend_base()

    def redir(ok: bool, msg: str = "") -> RedirectResponse:
        if ok:
            return RedirectResponse(url=f"{base}/payment?kcp=ok", status_code=303)
        q = quote(msg[:200], safe="")
        return RedirectResponse(url=f"{base}/payment?kcp=fail&reason={q}", status_code=303)

    if not ordr_idxx.strip():
        return redir(False, "ordr_idxx 없음")

    intent = (
        db.query(PaymentIntent)
        .filter(PaymentIntent.merchant_order_id == ordr_idxx.strip())
        .order_by(PaymentIntent.id.desc())
        .first()
    )
    if intent is None:
        return redir(False, "주문번호 불일치")

    if intent.status == "paid":
        return redir(True)

    extra = dict(intent.pg_extra or {})
    extra["kcp_return_form"] = {
        "res_cd": res_cd,
        "res_msg": res_msg,
        "tran_cd": tran_cd,
        "good_mny": good_mny,
    }

    if str(res_cd) != "0000":
        intent.status = "failed"
        intent.pg_extra = extra
        db.add(intent)
        db.commit()
        return redir(False, res_msg or f"인증실패 {res_cd}")

    if good_mny and str(intent.amount_krw) != str(good_mny).strip():
        intent.status = "failed"
        extra["amount_mismatch"] = {"db": intent.amount_krw, "form": good_mny}
        intent.pg_extra = extra
        db.add(intent)
        db.commit()
        return redir(False, "금액 불일치")

    cfg = load_kcp_settings(require_cert=True)
    if not cfg or not cfg.cert_info:
        intent.status = "failed"
        intent.pg_extra = extra
        db.add(intent)
        db.commit()
        return redir(False, "KCP_CERT_INFO 미설정으로 승인 불가")

    if not enc_data or not enc_info or not tran_cd:
        intent.status = "failed"
        intent.pg_extra = extra
        db.add(intent)
        db.commit()
        return redir(False, "승인에 필요한 enc/tran_cd 누락")

    try:
        pay_res = request_payment_approval(
            site_cd=cfg.site_cd,
            cert_info=cfg.cert_info,
            enc_data=enc_data,
            enc_info=enc_info,
            tran_cd=tran_cd,
            ordr_no=ordr_idxx.strip(),
            ordr_mny=str(intent.amount_krw),
            pay_type=_pay_type_default(),
            payment_url=cfg.payment_url,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("KCP payment approval HTTP error")
        intent.status = "failed"
        extra["kcp_approval_error"] = str(exc)[:500]
        intent.pg_extra = extra
        db.add(intent)
        db.commit()
        return redir(False, "승인 통신 오류")

    extra["kcp_approval"] = pay_res

    if not _kcp_payment_ok(pay_res):
        intent.status = "failed"
        intent.pg_extra = extra
        db.add(intent)
        db.commit()
        msg = pay_res.get("res_msg") or pay_res.get("resMsg") or str(pay_res)
        return redir(False, msg)

    intent.status = "paid"
    intent.paid_at = datetime.now(timezone.utc)
    intent.pg_extra = extra

    if intent.intent_kind == "point_charge":
        extra["points_awarded"] = intent.amount_krw
        extra["points_credited"] = True
        intent.pg_extra = extra
        u = db.query(User).filter(User.id == intent.user_id).with_for_update().first()
        if u is None:
            logger.error("KCP paid intent %s: user %s missing", intent.id, intent.user_id)
        else:
            u.points_balance = int(u.points_balance or 0) + int(intent.amount_krw)
            db.add(u)

    db.add(intent)
    db.commit()

    tab = "&tab=user" if intent.intent_kind == "point_charge" else ""
    return RedirectResponse(
        url=f"{base}/payment?kcp=ok&intent_id={intent.id}{tab}",
        status_code=303,
    )
