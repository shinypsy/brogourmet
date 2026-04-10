"""BroG 가맹(지도 깃발 등) 표시 — DB `franchise_pin`이 우선, 없으면 등록자 역할."""

from __future__ import annotations

from app.core.roles import FRANCHISE


def effective_restaurant_is_franchise(franchise_pin: bool | None, submitter_role: str | None) -> bool:
    """`franchise_pin` True/False면 강제, NULL이면 `submitter_role == franchise` 여부."""
    if franchise_pin is True:
        return True
    if franchise_pin is False:
        return False
    return submitter_role == FRANCHISE
