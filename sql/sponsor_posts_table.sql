-- Purpose: SPON(sponsor_posts) 테이블 — 기존 PostgreSQL DB에 수동 추가 시 사용.
-- Prerequisite: users 테이블 존재.
-- Note: FastAPI lifespan 에서 Base.metadata.create_all 로 신규 테이블이 자동 생성되기도 함.
-- 실행: psql "$DATABASE_URL" -f sql/sponsor_posts_table.sql

CREATE TABLE IF NOT EXISTS sponsor_posts (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users (id),
    title VARCHAR(200) NOT NULL,
    excerpt VARCHAR(300) NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    accent VARCHAR(32) NOT NULL DEFAULT '#4a5568',
    image_urls JSON,
    external_url VARCHAR(800),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sponsor_posts_author_id ON sponsor_posts (author_id);
