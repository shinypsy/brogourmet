"""Lightweight schema patches for existing DBs (create_all does not add new columns)."""

import logging
import os

from sqlalchemy import func, text

from app.db import SessionLocal, engine
from app.models.user import User

logger = logging.getLogger(__name__)

# 기본값: 해당 계정이 가입되어 있으면 매 부팅 시 슈퍼 관리자로 승격. 환경변수 SUPER_ADMIN_EMAIL 로 변경 가능.
_DEFAULT_SUPER_ADMIN_EMAIL = "2corea@gmail.com"


def ensure_super_admin_email() -> None:
    """지정 이메일 사용자를 super_admin 으로 맞춤(이미 가입된 경우에만)."""
    raw = (os.environ.get("SUPER_ADMIN_EMAIL") or _DEFAULT_SUPER_ADMIN_EMAIL).strip()
    if not raw:
        return
    email_lower = raw.lower()
    db = SessionLocal()
    try:
        u = db.query(User).filter(func.lower(User.email) == email_lower).first()
        if u is None:
            logger.debug("Super-admin email %s: no user row yet (sign up first).", raw)
            return
        if u.role != "super_admin":
            u.role = "super_admin"
            db.commit()
            logger.info("Role set to super_admin for %s", raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ensure_super_admin_email skipped: %s", exc)
    finally:
        db.close()


def ensure_user_role_migration() -> None:
    """레거시 role 문자열만 정리 (구 스키마에 users 테이블이 있을 때)."""
    try:
        with engine.begin() as conn:
            conn.execute(text("UPDATE users SET role = 'super_admin' WHERE role = 'admin'"))
        logger.info("Legacy admin -> super_admin migration applied if applicable.")
    except Exception as exc:  # noqa: BLE001
        logger.debug("User role migration skipped: %s", exc)


def ensure_post_image_columns() -> None:
    statements = [
        "ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))
    logger.info("Post image_url columns ensured (free_share_posts, known_restaurant_posts).")


def ensure_restaurant_image_urls_and_points() -> None:
    """BroG: 다중 이미지(최대 5)·포인트 적립 플래그."""
    dialect = engine.dialect.name
    # PostgreSQL: JSON, SQLite: TEXT (SQLAlchemy JSON 양쪽 모두 list 직렬화)
    image_urls_type = "JSON" if dialect == "postgresql" else "TEXT"
    statements = [
        f"ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS image_urls {image_urls_type}",
        "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS points_eligible BOOLEAN DEFAULT TRUE",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))
    logger.info("Restaurant image_urls / points_eligible columns ensured.")


def ensure_restaurant_bro_list_pin() -> None:
    """BroG 공개 목록 1~4위 관리자 고정 슬롯."""
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bro_list_pin INTEGER"),
        )
    logger.info("Restaurant bro_list_pin column ensured.")


def ensure_known_restaurant_brog_shape() -> None:
    """MyG: BroG 작성 폼과 동일 필드(변환 대비)."""
    dialect = engine.dialect.name
    image_urls_type = "JSON" if dialect == "postgresql" else "TEXT"
    statements = [
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '서울특별시'",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS district_id INTEGER",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS category VARCHAR(80)",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS summary TEXT",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
        f"ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS image_urls {image_urls_type}",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS menu_lines TEXT",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))
        try:
            conn.execute(
                text(
                    "UPDATE known_restaurant_posts SET city = '서울특별시' "
                    "WHERE city IS NULL OR TRIM(COALESCE(city, '')) = ''"
                )
            )
        except Exception:  # noqa: BLE001
            pass
    logger.info("known_restaurant_posts BroG-shape columns ensured.")
