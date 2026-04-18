-- brogourmet API (gourmet) — PostgreSQL schema
-- 새 DB에 테이블을 만들 때 사용. 이미 FastAPI create_all로 만든 DB에는 중복 생성 오류가 날 수 있음.
-- 한 번에 실행: psql "$DATABASE_URL" -f schema.sql

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT '서울특별시',
    district VARCHAR(50) NOT NULL,
    category VARCHAR(80) NOT NULL,
    summary TEXT NOT NULL,
    image_url VARCHAR(500),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_restaurants_district ON restaurants (district);

CREATE TABLE restaurant_menu_items (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    price_krw INTEGER NOT NULL,
    is_main_menu BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX ix_restaurant_menu_items_restaurant_id ON restaurant_menu_items (restaurant_id);

CREATE TABLE payment_intents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id),
    amount_krw INTEGER NOT NULL,
    description VARCHAR(500),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    intent_kind VARCHAR(32) NOT NULL DEFAULT 'merchant',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    merchant_order_id VARCHAR(70),
    paid_at TIMESTAMPTZ,
    pg_extra JSON
);

CREATE INDEX ix_payment_intents_user_id ON payment_intents (user_id);
CREATE UNIQUE INDEX uq_payment_intents_merchant_order_id ON payment_intents (merchant_order_id)
    WHERE merchant_order_id IS NOT NULL;

CREATE TABLE free_share_posts (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users (id),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    district VARCHAR(50),
    image_url VARCHAR(500),
    image_urls JSON,
    share_completed BOOLEAN NOT NULL DEFAULT FALSE,
    share_category VARCHAR(20) NOT NULL DEFAULT 'other',
    share_latitude DOUBLE PRECISION,
    share_longitude DOUBLE PRECISION,
    share_place_label VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_free_share_posts_author_id ON free_share_posts (author_id);

CREATE TABLE free_share_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES free_share_posts (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_free_share_comments_post_id ON free_share_comments (post_id);
CREATE INDEX ix_free_share_comments_user_id ON free_share_comments (user_id);

CREATE TABLE known_restaurant_posts (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users (id),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    restaurant_name VARCHAR(200) NOT NULL,
    district VARCHAR(50) NOT NULL,
    main_menu_name VARCHAR(200) NOT NULL,
    main_menu_price INTEGER NOT NULL,
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_known_restaurant_posts_author_id ON known_restaurant_posts (author_id);

-- SPON: 스폰서 콘텐츠 (BroG restaurants 와 별도)
CREATE TABLE sponsor_posts (
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

CREATE INDEX ix_sponsor_posts_author_id ON sponsor_posts (author_id);
