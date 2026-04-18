"""1단계 배포: DEPLOY_STAGE1 켜짐 시 서울 25개 자치구만 API에서 노출·허용(기본).

broke `data/regions.ts` 의 `seoulDistricts` 와 동일 순서·이름 유지.
"""

from __future__ import annotations

import os

# broke `src/data/regions.ts` `seoulDistricts` 와 동일 순서·이름.
DEFAULT_STAGE1_DISTRICTS: tuple[str, ...] = (
    "강남구",
    "강동구",
    "강북구",
    "강서구",
    "관악구",
    "광진구",
    "구로구",
    "금천구",
    "노원구",
    "도봉구",
    "동대문구",
    "동작구",
    "마포구",
    "서대문구",
    "서초구",
    "성동구",
    "성북구",
    "송파구",
    "양천구",
    "영등포구",
    "용산구",
    "은평구",
    "종로구",
    "중구",
    "중랑구",
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
