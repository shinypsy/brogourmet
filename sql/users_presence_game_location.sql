-- 친구찾기(접속·게임 좌표) 테스트용 users 컬럼.
-- 실제 적용: gourmet 기동 시 db_migrate.ensure_user_presence_game_columns() 가 IF NOT EXISTS 로 수행.
-- 수동 실행 시: psql "$DATABASE_URL" -f sql/users_presence_game_location.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_lng DOUBLE PRECISION;
