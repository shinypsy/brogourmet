"""BroG(`Restaurant` + 메뉴) → MyG(`KnownRestaurantPostCreate`) 매핑.

MyG로 내려받을 때 이미지가 깨지는 흔한 이유:
- DB에 `http://localhost:8000/uploads/...` 같은 **절대 URL**이 남아 있으면, 사용자는 `:5173`·LAN IP로
  접속하는데 브라우저만 옛 호스트로 요청해 404가 난다 → 응답·DB에는 **`/uploads/...` 상대 경로**로 통일.
- 경로에 **퍼센트 인코딩**(`%20`)이 있으면 디스크 파일명과 안 맞아 복사가 실패한다 → URL 경로는 `unquote` 후 매칭.
- `/uploads/brog/a/b.jpg` **하위 폴더**는 예전 로직에서 복사 대상에서 빠졌다 → 업로드 루트 아래 안전한 상대 경로만 허용해 복사.

서버 디스크에 파일이 있으면 `/uploads/myg/` 로 복사하고, 없으면 상대 `/uploads/...`만 남긴다(외부 CDN URL은 유지).
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import uuid4

from app.api.restaurants import _restaurant_image_urls_list
from app.core.storage import BROG_UPLOAD_DIR, LEGACY_UPLOAD_DIR, MYG_UPLOAD_DIR
from app.models.restaurant import Restaurant
from app.schemas.community import KnownRestaurantPostCreate

logger = logging.getLogger(__name__)


def _image_urls_for_post(r: Restaurant, max_n: int = 5) -> list[str]:
    """BroG API와 동일 규칙(JSON 문자열·image_url 폴백) — 직접 순회 시 문자열 JSON을 글자 단위로 도는 버그 방지."""
    return _restaurant_image_urls_list(r)[:max_n]


def _upload_path_from_stored_url(url: str) -> str | None:
    """로컬 업로드 트리로 매핑 가능한 경로 `/uploads/...` 또는 None(외부 URL 등).

    - 리버스 프록시 경로 `/api/.../uploads/brog/...` 등에서도 `/uploads/` 이후만 추출.
    - 프로토콜 상대 URL `//host/uploads/...` 지원.
    """
    t = (url or "").strip()[:500]
    if not t:
        return None
    if t.startswith("//"):
        t = "https:" + t
    if t.startswith("http://") or t.startswith("https://"):
        path_part = unquote((urlparse(t).path or "").split("?")[0])
    else:
        path_part = unquote(t.split("?")[0].strip())
        if path_part and not path_part.startswith("/"):
            path_part = "/" + path_part.lstrip("/")
    idx = path_part.find("/uploads/")
    if idx < 0:
        return None
    rel = path_part[idx:]
    if ".." in rel:
        return None
    return rel


def _prefer_relative_upload_ref(u: str) -> str:
    """DB·API 응답에는 `/uploads/...` 상대 경로를 우선 저장 — 프론트가 `VITE_API_BASE_URL`로 해석."""
    t = (u or "").strip()[:500]
    if t.startswith("//"):
        t = "https:" + t
    if t.startswith("http://") or t.startswith("https://"):
        p = unquote((urlparse(t).path or "").split("?")[0])
        if p.startswith("/uploads/"):
            return p
        idx = p.find("/uploads/")
        if idx >= 0:
            suffix = p[idx:]
            if ".." not in suffix:
                return suffix
    return t


def _safe_file_under_upload_root(root: Path, relative_after_prefix: str) -> Path | None:
    """`/uploads/brog/` 이후 상대 경로(하위 폴더 허용). `..` 차단."""
    rel = (relative_after_prefix or "").strip().replace("\\", "/")
    if not rel or ".." in rel:
        return None
    parts = [p for p in rel.split("/") if p and p != "."]
    if not parts:
        return None
    try:
        root_r = root.resolve()
        candidate = (root_r.joinpath(*[unquote(p) for p in parts])).resolve()
        candidate.relative_to(root_r)
    except (ValueError, OSError):
        return None
    return candidate if candidate.is_file() else None


def _external_or_other_url(url: str) -> str | None:
    """그대로 MyG에 넣을 비업로드 URL(외부 CDN 등)."""
    t = (url or "").strip()[:500]
    if not t:
        return None
    if t.startswith("http://") or t.startswith("https://"):
        p = (urlparse(t).path or "").split("?")[0]
        if p.startswith("/uploads/"):
            return None
        return t
    if t.startswith("/") and not t.startswith("/uploads/"):
        return t.split("?")[0]
    return None


def _source_file_for_upload_path(path: str) -> Path | None:
    """`/uploads/brog/…`, `/uploads/myg/…`, `/uploads/…`(레거시 평면·하위 경로) → 디스크 경로."""
    raw = (path or "").split("?")[0]
    if ".." in raw:
        return None
    if raw.startswith("/uploads/brog/"):
        rel = raw[len("/uploads/brog/") :].strip()
        return _safe_file_under_upload_root(BROG_UPLOAD_DIR, rel)
    if raw.startswith("/uploads/myg/"):
        rel = raw[len("/uploads/myg/") :].strip()
        return _safe_file_under_upload_root(MYG_UPLOAD_DIR, rel)
    if raw.startswith("/uploads/"):
        rel = raw[len("/uploads/") :].strip()
        return _safe_file_under_upload_root(LEGACY_UPLOAD_DIR, rel)
    return None


def _copy_upload_to_myg(upload_path: str) -> str | None:
    """로컬 파일이 있으면 MYG 디렉터리로 복사하고 `/uploads/myg/{name}` 반환."""
    src = _source_file_for_upload_path(upload_path)
    if src is None:
        return None
    suffix = src.suffix.lower() or ".jpg"
    if suffix not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        suffix = ".jpg"
    dest_name = f"{uuid4().hex}{suffix}"
    MYG_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = MYG_UPLOAD_DIR / dest_name
    try:
        shutil.copy2(src, dest)
    except OSError as exc:
        logger.warning("brog_to_myg: copy %s -> %s failed: %s", src, dest, exc)
        return None
    return f"/uploads/myg/{dest_name}"


def materialize_image_urls_for_myg_from_brog(urls: list[str], max_n: int = 5) -> list[str]:
    """
    BroG에 저장된 URL 목록 → MyG에 저장할 URL 목록.
    - 서버 디스크에 있는 `/uploads/brog|myg|평면` 파일은 `/uploads/myg/` 로 복사.
    - 복사 실패 시 `/uploads/...` 상대 경로로 정규화(잘못된 절대 호스트 제거).
    - 외부 http(s) URL은 그대로 유지.
    """
    out: list[str] = []
    seen: set[str] = set()
    for u in urls:
        if len(out) >= max_n:
            break
        upath = _upload_path_from_stored_url(u)
        if upath:
            copied = _copy_upload_to_myg(upath)
            final = copied if copied else upath
            final = _prefer_relative_upload_ref(final)
            if final not in seen:
                seen.add(final)
                out.append(final)
            continue
        ext = _external_or_other_url(u)
        if ext:
            ext = _prefer_relative_upload_ref(ext)
        if ext and ext not in seen:
            seen.add(ext)
            out.append(ext)
    return out


def build_known_restaurant_create_from_brog(r: Restaurant) -> KnownRestaurantPostCreate:
    """`district`·`menu_items` 관계가 로드된 `Restaurant` 필요."""
    d = r.district
    district_name = (d.name if d else "").strip()[:50]
    raw_imgs = _image_urls_for_post(r)
    imgs = materialize_image_urls_for_myg_from_brog(raw_imgs)

    menu_items = list(r.menu_items)
    if menu_items:
        mains = [m for m in menu_items if m.is_main_menu]
        others = [m for m in menu_items if not m.is_main_menu]
        others_sorted = sorted(
            others,
            key=lambda m: (m.card_slot is None, m.card_slot if m.card_slot is not None else 999, m.id),
        )
        ordered = mains + others_sorted
        lines = [f"{m.name.strip()} : {m.price_krw}원" for m in ordered if m.name.strip()]
        menu_lines = "\n".join(lines)
        if menu_lines.strip():
            return KnownRestaurantPostCreate(
                restaurant_name=r.name.strip()[:200],
                district_id=r.district_id,
                city=(r.city or "서울특별시").strip()[:100],
                category=r.category.strip()[:80],
                summary=r.summary.strip(),
                menu_lines=menu_lines,
                latitude=r.latitude,
                longitude=r.longitude,
                image_urls=imgs,
                image_url=imgs[0] if imgs else None,
                title=r.name.strip()[:200],
                body=r.summary.strip()[:8000],
            )

    return KnownRestaurantPostCreate(
        restaurant_name=r.name.strip()[:200],
        district=district_name,
        title=r.name.strip()[:200],
        body=r.summary.strip()[:8000],
        main_menu_name="메뉴 미등록",
        main_menu_price=0,
        image_url=imgs[0] if imgs else None,
        image_urls=imgs,
        city=(r.city or "서울특별시").strip()[:100],
        category=r.category.strip()[:80] if r.category else None,
        summary=r.summary.strip() if r.summary else None,
        latitude=r.latitude,
        longitude=r.longitude,
        district_id=None,
        menu_lines=None,
    )
