"""POST /uploads/{brog|myg|legacy}/image 동작·디스크 저장 확인 (로컬 일회 점검용)."""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from unittest.mock import MagicMock

# 프로젝트 루트(gourmet/)를 path에 넣음
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv

load_dotenv(_ROOT / ".env")

MINIMAL_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="
)


def _file_set(d: Path) -> set[str]:
    if not d.exists():
        return set()
    return {p.name for p in d.iterdir() if p.is_file()}


def _probe_one(
    client,
    path: str,
    upload_dir: Path,
    url_prefix: str,
    label: str,
) -> bool:
    from app.deps import get_current_user

    before = _file_set(upload_dir)

    def fake_user():
        m = MagicMock()
        m.id = 1
        return m

    app = client.app
    app.dependency_overrides[get_current_user] = fake_user
    try:
        r = client.post(
            path,
            files={"file": (f"probe_{label}.jpg", MINIMAL_JPEG, "image/jpeg")},
        )
    finally:
        app.dependency_overrides.clear()

    print(f"{label} POST {path} status:", r.status_code)
    try:
        body = r.json()
        print("  response:", body)
        url = body.get("url", "")
    except Exception:
        print("  body:", r.text[:500])
        return False

    if r.status_code != 200:
        return False

    rel = url.removeprefix(url_prefix).lstrip("/") or ""
    dest = upload_dir / rel if rel else None
    if dest and dest.is_file():
        print("  OK: 파일 존재:", dest, "size:", dest.stat().st_size)
        return True

    after = _file_set(upload_dir)
    new_files = after - before
    if new_files:
        print("  OK: 신규 파일:", new_files)
        return True

    print("  FAIL: 응답은 200이나 디스크에서 파일을 찾지 못함")
    return False


def main() -> int:
    try:
        from starlette.testclient import TestClient
    except RuntimeError as e:
        print("starlette.testclient 필요: pip install httpx")
        print(e)
        return 1

    from app.core.storage import BROG_UPLOAD_DIR, LEGACY_UPLOAD_DIR, MYG_UPLOAD_DIR
    from app.main import app

    client = TestClient(app)
    ok = True
    ok &= _probe_one(client, "/uploads/brog/image", BROG_UPLOAD_DIR, "/uploads/brog", "brog")
    ok &= _probe_one(client, "/uploads/myg/image", MYG_UPLOAD_DIR, "/uploads/myg", "myg")
    ok &= _probe_one(client, "/uploads/image", LEGACY_UPLOAD_DIR, "/uploads", "legacy")
    print("BROG_UPLOAD_DIR:", BROG_UPLOAD_DIR)
    print("MYG_UPLOAD_DIR:", MYG_UPLOAD_DIR)
    print("LEGACY_UPLOAD_DIR:", LEGACY_UPLOAD_DIR)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
