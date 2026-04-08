import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_PROJECT_ROOT = Path(__file__).resolve().parents[2]

# -----------------------------------------------------------------------------
# 업로드 저장소 (BroG vs MyG·커뮤니티 분리)
# - 로컬 개발: 기본값은 모두 gourmet/uploads 하위 폴더 (로컬 전용).
# - 1단계 배포 전: BroG 만 서버(UNC/NAS 등)로 두려면 BROG_UPLOAD_DIR 만 서버 경로로 지정.
# - MyG·무료나눔: MYG_UPLOAD_DIR 로 로컬 유지.
# -----------------------------------------------------------------------------

# 레거시 평면 URL: /uploads/{uuid}.jpg — 기존 DB·NAS 평면 파일
# 우선순위: LEGACY_UPLOAD_DIR → (구호환) COMMUNITY_IMAGE_DIR → gourmet/uploads
LEGACY_UPLOAD_DIR = Path(
    os.getenv(
        "LEGACY_UPLOAD_DIR",
        os.getenv("COMMUNITY_IMAGE_DIR", str(_PROJECT_ROOT / "uploads")),
    )
)

# BroG 신규 업로드: /uploads/brog/{filename}
BROG_UPLOAD_DIR = Path(os.getenv("BROG_UPLOAD_DIR", str(_PROJECT_ROOT / "uploads" / "brog")))

# MyG·무료나눔 등: /uploads/myg/{filename}
MYG_UPLOAD_DIR = Path(os.getenv("MYG_UPLOAD_DIR", str(_PROJECT_ROOT / "uploads" / "myg")))

# 구 스크립트·문서 호환 (레거시 평면 디렉터리와 동일)
COMMUNITY_IMAGE_DIR = LEGACY_UPLOAD_DIR
