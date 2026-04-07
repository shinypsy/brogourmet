"""
PostgreSQL 에 brogourmet_user / brogourmet DB 가 없으면 생성.
슈퍼유저 접속 URL 이 필요함.

  set POSTGRES_SUPER_URL=postgresql://postgres:비밀번호@localhost:5432/postgres
  python scripts/create_database.py

이후: uvicorn 기동 시 create_all 로 테이블 생성.
"""

from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

TARGET_DB = "brogourmet"
TARGET_USER = "brogourmet_user"
TARGET_PASSWORD = os.environ.get("BROGOURMET_DB_PASSWORD", "1234")


def main() -> None:
    super_url = os.environ.get("POSTGRES_SUPER_URL")
    if not super_url:
        print("환경변수 POSTGRES_SUPER_URL 을 설정하세요.", file=sys.stderr)
        print("예: postgresql://postgres:비밀번호@localhost:5432/postgres", file=sys.stderr)
        sys.exit(1)

    engine = create_engine(super_url, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        try:
            conn.execute(
                text(f"CREATE USER {TARGET_USER} WITH LOGIN PASSWORD :pw"),
                {"pw": TARGET_PASSWORD},
            )
            print(f"CREATE USER {TARGET_USER} OK")
        except ProgrammingError as e:
            if "already exists" in str(e).lower():
                print(f"USER {TARGET_USER} 이미 있음")
            else:
                raise

        r = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TARGET_DB})
        if r.scalar():
            print(f"DATABASE {TARGET_DB} 이미 있음")
        else:
            conn.execute(text(f'CREATE DATABASE "{TARGET_DB}" OWNER ' + TARGET_USER))
            print(f"CREATE DATABASE {TARGET_DB} OK")

    grant_engine = create_engine(
        super_url.rsplit("/", 1)[0] + "/" + TARGET_DB,
        isolation_level="AUTOCOMMIT",
    )
    with grant_engine.connect() as conn:
        conn.execute(text(f"GRANT ALL ON SCHEMA public TO {TARGET_USER}"))
        conn.execute(text(f"GRANT CREATE ON SCHEMA public TO {TARGET_USER}"))
        print("GRANT public OK")

    print("다음: gourmet/.env DATABASE_URL 로 백엔드 기동")


if __name__ == "__main__":
    main()
