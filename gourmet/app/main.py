import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.storage import COMMUNITY_IMAGE_DIR
from app.api.auth import router as auth_router
from app.api.free_share import router as free_share_router
from app.api.known_restaurants import router as known_restaurants_router
from app.api.payments import router as payments_router
from app.api.restaurants import router as restaurants_router
from app.api.uploads import router as uploads_router
from app.api.users import router as users_router
from app.db import Base, SessionLocal, engine
from app.db_migrate import ensure_post_image_columns
from app.models import (  # noqa: F401 — register metadata for create_all
    FreeSharePost,
    KnownRestaurantPost,
    PaymentIntent,
    Restaurant,
    RestaurantMenuItem,
    User,
)
from app.seed import seed_restaurants

logger = logging.getLogger(__name__)

_CORS_ORIGIN_RE = re.compile(
    r"^http://(127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3}):5173$",
)
_CORS_ORIGINS = frozenset(
    {
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://192.168.0.250:5173",
    },
)


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
    ensure_post_image_columns()
    db = SessionLocal()
    try:
        seed_restaurants(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Brogourmet API", lifespan=lifespan)
# CORSMiddleware는 add_middleware 목록에서 가장 마지막에 넣어야 요청 파이프라인에서 먼저 실행됨(프리플라이트·헤더 부착).
app.add_middleware(UnhandledExceptionCorsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://192.168.0.250:5173",
    ],
    allow_origin_regex=r"^http://(127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3}):5173$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(restaurants_router)
app.include_router(free_share_router)
app.include_router(known_restaurants_router)
app.include_router(payments_router)
app.include_router(uploads_router)
COMMUNITY_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=COMMUNITY_IMAGE_DIR), name="uploads")


@app.get("/")
def root():
    return {"message": "Brogourmet API is running"}


@app.get("/db-check")
def db_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"db_status": "connected", "result": result.scalar()}
