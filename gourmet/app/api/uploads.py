import mimetypes
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.storage import BROG_UPLOAD_DIR, LEGACY_UPLOAD_DIR, MYG_UPLOAD_DIR
from app.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _safe_upload_basename(filename: str) -> str | None:
    """경로 조각 없이 파일명 한 덩어리만 허용 (uuid.jpg 형태)."""
    if not filename or "/" in filename or "\\" in filename or filename.strip() != filename:
        return None
    base = Path(filename).name
    if not base or base != filename or ".." in base:
        return None
    return base


def _file_if_under_root(root: Path, candidate: Path) -> Path | None:
    try:
        r = root.resolve()
        c = candidate.resolve()
        c.relative_to(r)
    except (ValueError, OSError):
        return None
    return c if c.is_file() else None


def _find_upload_basename_under_root(root: Path, basename: str) -> Path | None:
    """루트 직하위 → 그 아래 재귀(예: brog 하위 폴더) 순으로 동일 파일명 검색."""
    if not basename:
        return None
    try:
        r = root.resolve()
    except OSError:
        return None
    if not r.is_dir():
        return None
    hit = _file_if_under_root(root, root / basename)
    if hit is not None:
        return hit
    try:
        for p in r.rglob(basename):
            if not p.is_file() or p.name != basename:
                continue
            hit = _file_if_under_root(root, p)
            if hit is not None:
                return hit
    except OSError:
        return None
    return None


@router.get("/myg/{filename}")
async def get_myg_image(filename: str):
    """
    MyG URL은 `/uploads/myg/` 고정이나, 실제 파일이 레거시 평면·BroG 쪽에만 있는 DB/복사 이슈가 있을 수 있음.
    MYG_UPLOAD_DIR → LEGACY_UPLOAD_DIR(평면·하위) → BROG_UPLOAD_DIR(평면·하위) 순으로 같은 파일명을 찾아 서빙.
    """
    base = _safe_upload_basename(filename)
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for folder in (MYG_UPLOAD_DIR, LEGACY_UPLOAD_DIR, BROG_UPLOAD_DIR):
        hit = _find_upload_basename_under_root(folder, base)
        if hit is not None:
            media_type, _ = mimetypes.guess_type(hit.name)
            return FileResponse(hit, media_type=media_type or "application/octet-stream")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


async def _save_image_to_dir(
    upload_dir: Path,
    url_prefix: str,
    file: UploadFile,
) -> dict[str, str]:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only jpeg, png, webp, gif are allowed",
        )

    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    filename = f"{uuid4().hex}{suffix}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    destination = upload_dir / filename

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be 5MB or less",
        )
    try:
        destination.write_bytes(content)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file to storage: {exc}",
        ) from exc
    return {"url": f"{url_prefix}/{filename}"}


@router.post("/brog/image")
async def upload_brog_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """BroG 사진 — 저장: BROG_UPLOAD_DIR, URL: /uploads/brog/… (배포 시 서버 경로 권장)."""
    return await _save_image_to_dir(BROG_UPLOAD_DIR, "/uploads/brog", file)


@router.post("/myg/image")
async def upload_myg_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """MyG·무료나눔 등 — 저장: MYG_UPLOAD_DIR, URL: /uploads/myg/… (로컬 유지)."""
    return await _save_image_to_dir(MYG_UPLOAD_DIR, "/uploads/myg", file)


@router.post("/image")
async def upload_image_legacy(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """
    레거시 평면 업로드: /uploads/{filename}
    구 클라이언트 호환. 신규는 BroG→/uploads/brog/image, MyG→/uploads/myg/image 권장.
    """
    return await _save_image_to_dir(LEGACY_UPLOAD_DIR, "/uploads", file)
