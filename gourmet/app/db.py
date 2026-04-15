import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Windows: .env 를 UTF-8(또는 UTF-8 BOM)으로 저장. UTF-16으로 저장되면 URL이 깨질 수 있음.
load_dotenv(encoding="utf-8-sig")

_raw_url = (os.getenv("DATABASE_URL") or "").strip()
if not _raw_url:
    raise ValueError("DATABASE_URL is not set. Add it to gourmet/.env.")
DATABASE_URL = _raw_url.replace("\x00", "").strip()
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is empty after trimming.")


def _sqlalchemy_url(url: str) -> str:
    """postgresql:// → postgresql+psycopg:// (psycopg v3).

    PostgreSQL이 연결 거부 시 한글 메시지를 주면, 예전 psycopg2는 디코딩 단계에서
    UnicodeDecodeError 로 원인이 가려지는 경우가 있음. psycopg3 는 OperationalError 로 남김.
    """
    if url.startswith("postgresql+psycopg"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


engine = create_engine(_sqlalchemy_url(DATABASE_URL))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
