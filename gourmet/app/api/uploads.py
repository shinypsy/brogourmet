from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.storage import BROG_UPLOAD_DIR, LEGACY_UPLOAD_DIR, MYG_UPLOAD_DIR
from app.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


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
