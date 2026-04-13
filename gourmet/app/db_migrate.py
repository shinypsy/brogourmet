"""Lightweight schema patches for existing DBs (create_all does not add new columns)."""

import logging
import os

from sqlalchemy import func, inspect, text

from app.db import SessionLocal, engine
from app.models.free_share_post import FreeSharePost
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
    """BroG: 다중 이미지(최대 6)·포인트 적립 플래그."""
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


def ensure_restaurant_franchise_pin() -> None:
    """BroG 가맹 깃발 — 관리자 지정(NULL=등록자 역할 따름)."""
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS franchise_pin BOOLEAN"),
        )
    logger.info("Restaurant franchise_pin column ensured.")


def ensure_bro_list_pin_not_globally_unique() -> None:
    """bro_list_pin 컬럼만 걸린 UNIQUE(전 테이블에서 비NULL 1개만 허용) 제거.

    평소 부팅에서는 호출하지 않음. `main.py`에서 `BROG_REPAIR_BRO_LIST_PIN_UNIQUE=1` 일 때만 실행.
    """
    prep = engine.dialect.identifier_preparer
    try:
        insp = inspect(engine)
        if not insp.has_table("restaurants"):
            return
        with engine.begin() as conn:
            for uc in insp.get_unique_constraints("restaurants"):
                cols = uc.get("column_names") or []
                if cols != ["bro_list_pin"]:
                    continue
                cname = uc.get("name")
                if not cname:
                    continue
                q = prep.quote(cname)
                conn.execute(text(f"ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS {q}"))
                logger.info("Dropped erroneous UNIQUE constraint on restaurants(bro_list_pin): %s", cname)
            for idx in insp.get_indexes("restaurants"):
                if not idx.get("unique"):
                    continue
                cols = idx.get("column_names") or []
                if cols != ["bro_list_pin"]:
                    continue
                iname = idx.get("name")
                if not iname:
                    continue
                q = prep.quote(iname)
                conn.execute(text(f"DROP INDEX IF EXISTS {q}"))
                logger.info("Dropped erroneous UNIQUE index on restaurants(bro_list_pin): %s", iname)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ensure_bro_list_pin_not_globally_unique skipped: %s", exc)


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


def ensure_free_share_image_urls_column() -> None:
    """무료나눔: 이미지 최대 6장(JSON 배열). 기존 image_url 은 단일 요소 배열로 이전."""
    dialect = engine.dialect.name
    col_type = "JSON" if dialect == "postgresql" else "TEXT"
    try:
        with engine.begin() as conn:
            conn.execute(
                text(f"ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS image_urls {col_type}"),
            )
        logger.info("free_share_posts.image_urls column ensured.")
    except Exception as exc:  # noqa: BLE001
        logger.debug("ensure_free_share_image_urls_column add column skipped: %s", exc)
        return
    db = SessionLocal()
    try:
        for p in db.query(FreeSharePost).all():
            raw = getattr(p, "image_urls", None)
            has_list = isinstance(raw, list) and len(raw) > 0
            if has_list:
                continue
            legacy = (p.image_url or "").strip()
            if legacy:
                p.image_urls = [legacy[:500]]
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("ensure_free_share_image_urls backfill skipped: %s", exc)
        db.rollback()
    finally:
        db.close()


def ensure_free_share_share_category_column() -> None:
    """무료나눔: 분류(음식·가전·가구·도서·기타)."""
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS share_category VARCHAR(20) "
                    "NOT NULL DEFAULT 'other'"
                )
            )
        logger.info("free_share_posts.share_category column ensured.")
    except Exception as exc:  # noqa: BLE001
        logger.debug("ensure_free_share_share_category_column skipped: %s", exc)


def ensure_free_share_place_columns() -> None:
    """무료나눔: 나눔 장소(위도·경도·표시용 주소 라벨)."""
    statements = [
        "ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS share_latitude DOUBLE PRECISION",
        "ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS share_longitude DOUBLE PRECISION",
        "ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS share_place_label VARCHAR(200)",
    ]
    try:
        with engine.begin() as conn:
            for sql in statements:
                conn.execute(text(sql))
        logger.info("free_share_posts share place columns ensured.")
    except Exception as exc:  # noqa: BLE001
        logger.debug("ensure_free_share_place_columns skipped: %s", exc)


def ensure_free_share_share_completed_column() -> None:
    """무료나눔: 나눔 완료 플래그."""
    dialect = engine.dialect.name
    default = "FALSE" if dialect == "postgresql" else "0"
    stmt = (
        f"ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS share_completed BOOLEAN "
        f"NOT NULL DEFAULT {default}"
    )
    try:
        with engine.begin() as conn:
            conn.execute(text(stmt))
        logger.info("free_share_posts.share_completed column ensured.")
    except Exception as exc:  # noqa: BLE001
        logger.debug("ensure_free_share_share_completed_column skipped: %s", exc)


def ensure_user_points_balance_column() -> None:
    """회원 포인트 잔액 — BroG 신규 등록(적립 대상) 시 가산."""
    dialect = engine.dialect.name
    default = "0"
    stmt = (
        f"ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT {default}"
    )
    try:
        with engine.begin() as conn:
            conn.execute(text(stmt))
        logger.info("users.points_balance column ensured.")
    except Exception as exc:  # noqa: BLE001
        logger.debug("ensure_user_points_balance_column skipped: %s", exc)


def ensure_user_password_change_columns() -> None:
    """Myinfo 비밀번호 변경용 이메일 인증코드."""
    dialect = engine.dialect.name
    exp_type = "TIMESTAMPTZ" if dialect == "postgresql" else "TEXT"
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_code_hash VARCHAR(128)",
        f"ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_expires_at {exp_type}",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))
    logger.info("users password_change_* columns ensured.")
