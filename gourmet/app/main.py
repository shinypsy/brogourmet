import logging
import os
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.storage import BROG_UPLOAD_DIR, LEGACY_UPLOAD_DIR, MYG_UPLOAD_DIR
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.districts import router as districts_router
from app.api.events import router as events_router
from app.api.free_share import router as free_share_router
from app.api.known_restaurants import router as known_restaurants_router
from app.api.ocr import router as ocr_router
from app.api.payments import router as payments_router
from app.api.restaurant_engagement import router as restaurant_engagement_router
from app.api.restaurants import router as restaurants_router
from app.api.site_notices import router as site_notices_router
from app.api.uploads import router as uploads_router
from app.api.users import router as users_router
from app.db import Base, SessionLocal, engine
from app.db_migrate import (
    ensure_bro_list_pin_not_globally_unique,
    ensure_free_share_image_urls_column,
    ensure_free_share_share_category_column,
    ensure_free_share_share_completed_column,
    ensure_free_share_place_columns,
    ensure_known_restaurant_brog_shape,
    ensure_post_image_columns,
    ensure_restaurant_bro_list_pin,
    ensure_restaurant_franchise_pin,
    ensure_restaurant_image_urls_and_points,
    ensure_super_admin_email,
    ensure_user_password_change_columns,
    ensure_user_points_balance_column,
    ensure_user_role_migration,
)
from app.models import (  # noqa: F401 — register metadata for create_all
    District,
    FreeShareComment,
    FreeSharePost,
    KnownRestaurantPost,
    PaymentIntent,
    Restaurant,
    SiteEvent,
    SiteNotice,
    RestaurantComment,
    RestaurantLike,
    RestaurantMenuItem,
    User,
)
from app.seed import ensure_mapo_brog_demo_restaurants, seed_districts, seed_restaurants

logger = logging.getLogger(__name__)


def _cors_extra_origins_from_env() -> frozenset[str]:
    """테스트·스테이징 배포 URL 등 — 쉼표 구분, 예: https://app.vercel.app,https://staging.example.com"""
    raw = os.environ.get("BROG_CORS_EXTRA_ORIGINS", "").strip()
    if not raw:
        return frozenset()
    return frozenset(o.strip() for o in raw.split(",") if o.strip())


# Vite dev 5173 · preview 4173. LAN 192.168.*.* 동일 포트 허용(IP 변경 시에도 재설정 최소화).
_CORS_ORIGIN_RE = re.compile(
    r"^http://(127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3}):(5173|4173)$",
)
_CORS_ORIGINS_BASE = frozenset(
    {
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    },
)
_CORS_ORIGINS = _CORS_ORIGINS_BASE | _cors_extra_origins_from_env()


def _ensure_upload_dir(label: str, directory) -> None:
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise RuntimeError(
            f"[{label}] 업로드 디렉터리를 사용할 수 없습니다: {directory}\n"
            f"  원인: {e!s}\n"
            "  gourmet/.env 의 LEGACY_UPLOAD_DIR · COMMUNITY_IMAGE_DIR · BROG_UPLOAD_DIR · MYG_UPLOAD_DIR 을\n"
            "  연결 가능한 로컬 경로로 바꾸거나, UNC(\\\\서버\\공유)를 쓰는 경우 해당 PC·공유가 켜져 있고 접근 가능한지 확인하세요."
        ) from e


def _cors_headers_for_request(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin")
    if not origin:
        return {}
    if origin in _CORS_ORIGINS or _CORS_ORIGIN_RE.match(origin):
        return {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
        }
    return {}


class UnhandledExceptionCorsMiddleware(BaseHTTPMiddleware):
    """처리되지 않은 예외 시 500 응답에 CORS 헤더가 없으면 브라우저가 CORS 오류로만 보여 줌."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled server error")
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
                headers=_cors_headers_for_request(request),
            )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_user_role_migration()
    ensure_user_points_balance_column()
    ensure_user_password_change_columns()
    ensure_post_image_columns()
    ensure_free_share_image_urls_column()
    ensure_free_share_share_category_column()
    ensure_free_share_share_completed_column()
    ensure_free_share_place_columns()
    ensure_restaurant_image_urls_and_points()
    ensure_restaurant_bro_list_pin()
    ensure_restaurant_franchise_pin()
    if os.environ.get("BROG_REPAIR_BRO_LIST_PIN_UNIQUE", "").strip().lower() in ("1", "true", "yes"):
        ensure_bro_list_pin_not_globally_unique()
    ensure_known_restaurant_brog_shape()
    ensure_super_admin_email()
    db = SessionLocal()
    try:
        seed_districts(db)
        seed_restaurants(db)
        ensure_mapo_brog_demo_restaurants(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Brogourmet API", lifespan=lifespan)
# CORSMiddleware는 add_middleware 목록에서 가장 마지막에 넣어야 요청 파이프라인에서 먼저 실행됨(프리플라이트·헤더 부착).
app.add_middleware(UnhandledExceptionCorsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(_CORS_ORIGINS),
    allow_origin_regex=r"^http://(127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3}):(5173|4173)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(districts_router)
app.include_router(events_router)
app.include_router(users_router)
app.include_router(restaurants_router)
app.include_router(restaurant_engagement_router)
app.include_router(free_share_router)
app.include_router(known_restaurants_router)
app.include_router(payments_router)
app.include_router(uploads_router)
app.include_router(ocr_router)
app.include_router(site_notices_router)
# 정적 경로: 구체적인 prefix 먼저 등록 (/uploads/brog, /uploads/myg → 마지막에 평면 레거시 /uploads)
_ensure_upload_dir("BroG 업로드", BROG_UPLOAD_DIR)
_ensure_upload_dir("MyG·무료나눔 업로드", MYG_UPLOAD_DIR)
_ensure_upload_dir("레거시 평면 업로드", LEGACY_UPLOAD_DIR)
app.mount("/uploads/brog", StaticFiles(directory=BROG_UPLOAD_DIR), name="uploads_brog")
app.mount("/uploads/myg", StaticFiles(directory=MYG_UPLOAD_DIR), name="uploads_myg")
app.mount("/uploads", StaticFiles(directory=LEGACY_UPLOAD_DIR), name="uploads_legacy")


@app.get("/")
def root():
    return {"message": "Brogourmet API is running"}


@app.get("/db-check")
def db_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"db_status": "connected", "result": result.scalar()}
