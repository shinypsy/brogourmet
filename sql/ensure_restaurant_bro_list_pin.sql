-- 목적: BroG 공개 목록에서 관리자가 1~4위까지 고정(pin)할 수 있도록 컬럼 추가.
-- 전제: restaurants 테이블 존재. 앱 부팅 시 db_migrate.ensure_restaurant_bro_list_pin()에서도 동일 실행.
-- 주의: 구(district)별로 동일 슬롯(1~4)은 한 매장만 갖도록 API에서 다른 행의 bro_list_pin을 NULL로 비움.
-- 실행: psql 또는 SQLite CLI에서 수동 적용 시 한 번만.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bro_list_pin INTEGER;

-- (선택) PostgreSQL만: 구별 슬롯 유일 제약 — 앱 로직으로 이미 보장하면 생략 가능
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurants_district_bro_list_pin
--   ON restaurants (district_id, bro_list_pin)
--   WHERE bro_list_pin IS NOT NULL;
