"""1단계 테스트·시범 배포: 선택 가능한 구(기본 6개)만 API에서 노출·허용."""

from __future__ import annotations

import os
# broke `deployStage1.ts` 의 DEPLOY_STAGE1_DISTRICTS 와 동일 순서·이름 유지.
DEFAULT_STAGE1_DISTRICTS: tuple[str, ...] = (
    "마포구",
    "용산구",
    "서대문구",
    "영등포구",
    "종로구",
    "중구",
)


def deploy_stage1_enabled() -> bool:
    return os.getenv("DEPLOY_STAGE1", "").lower() in ("1", "true", "yes")


def stage1_district_names() -> frozenset[str] | None:
    """DEPLOY_STAGE1 이 꺼져 있으면 None(제한 없음). 켜져 있으면 허용 구 이름 집합."""
    if not deploy_stage1_enabled():
        return None
    raw = os.getenv("DEPLOY_STAGE1_DISTRICT_NAMES", "").strip()
    if raw:
        names = frozenset(x.strip() for x in raw.split(",") if x.strip())
        return names if names else frozenset(DEFAULT_STAGE1_DISTRICTS)
    return frozenset(DEFAULT_STAGE1_DISTRICTS)


def district_name_in_stage1(name: str | None) -> bool:
    allowed = stage1_district_names()
    if allowed is None:
        return True
    if not name:
        return False
    return name.strip() in allowed
