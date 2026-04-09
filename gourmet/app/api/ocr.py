import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.deps import get_current_user
from app.models.user import User
from app.services.clova_ocr import call_clova_general_ocr, clova_ocr_configured

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["ocr"])

ALLOWED = {"image/jpeg", "image/png"}
MAX_BYTES = 5 * 1024 * 1024


@router.get("/clova/status")
def clova_status(_: User = Depends(get_current_user)):
    """키가 설정되어 있는지(값 노출 없음). 프론트에서 OCR 경로 선택용."""
    return {"clova_configured": clova_ocr_configured()}


@router.post("/clova/menu-image")
async def ocr_menu_image_clova(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    메뉴판 이미지 → CLOVA General OCR → 원문 텍스트(줄 단위 추출은 클라이언트 menuLines).
    JPEG/PNG만 허용(CLOVA 제약). 인증 필요(과금·남용 방지).
    """
    if not clova_ocr_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLOVA OCR is not configured on this server",
        )
    if file.content_type not in ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CLOVA 경로는 JPEG 또는 PNG만 지원합니다. WebP 등은 변환 후 업로드하세요.",
        )
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size must be 5MB or less",
        )
    try:
        text = await call_clova_general_ocr(
            file_bytes=raw,
            filename=file.filename or "menu.jpg",
            content_type=file.content_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.warning("CLOVA OCR failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("CLOVA OCR unexpected error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CLOVA OCR failed",
        ) from exc

    return {"text": text}
