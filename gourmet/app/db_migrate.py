"""Lightweight schema patches for existing DBs (create_all does not add new columns)."""

import logging

from sqlalchemy import text

from app.db import engine

logger = logging.getLogger(__name__)


def ensure_post_image_columns() -> None:
    statements = [
        "ALTER TABLE free_share_posts ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)",
        "ALTER TABLE known_restaurant_posts ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)",
    ]
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))
    logger.info("Post image_url columns ensured (free_share_posts, known_restaurant_posts).")
