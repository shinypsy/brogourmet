"""DB에서 벌떼·이미지 URL 샘플 조회 (일회 점검)."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")
sys.path.insert(0, str(_ROOT))

url = os.getenv("DATABASE_URL")
if not url:
    print("DATABASE_URL missing")
    sys.exit(1)

engine = create_engine(url)

q1 = """
SELECT id, name, image_url, image_urls::text
FROM restaurants
WHERE name ILIKE '%벌%' OR CAST(image_url AS TEXT) ILIKE '%벌%'
   OR CAST(image_urls AS TEXT) ILIKE '%벌%'
LIMIT 30
"""
q2 = """
SELECT id, title, image_url, image_urls::text
FROM known_restaurant_posts
WHERE title ILIKE '%벌%' OR CAST(image_url AS TEXT) ILIKE '%벌%'
   OR CAST(image_urls AS TEXT) ILIKE '%벌%'
LIMIT 30
"""

with engine.connect() as c:
    print("=== restaurants (벌 in name/url) ===")
    for row in c.execute(text(q1)):
        print(row)
    print("=== known_restaurant_posts ===")
    for row in c.execute(text(q2)):
        print(row)

    print("=== any image_url ending with .jpg sample (last 5 restaurants) ===")
    for row in c.execute(
        text(
            "SELECT id, name, image_url FROM restaurants ORDER BY id DESC LIMIT 5"
        )
    ):
        print(row)
