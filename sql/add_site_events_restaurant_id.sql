-- 목적: site_events에 가맹점(BroG) 전용 이벤트를 연결해, 상단 티커(전역)와 BroG 메인 리스트 카드 스티커를 구분한다.
-- 실행 전제/주의: PostgreSQL, 기존 site_events 테이블 존재. 적용 후 기존 행은 restaurant_id NULL(전역 티커)로 유지된다.
-- 실행 방법: 운영 DB에 수동 실행 (예: psql -f sql/add_site_events_restaurant_id.sql).
-- 관련: gourmet/app/models/site_event.py, app/api/events.py, app/api/restaurants.py

ALTER TABLE site_events
  ADD COLUMN IF NOT EXISTS restaurant_id INTEGER NULL REFERENCES restaurants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_site_events_restaurant_id ON site_events(restaurant_id);

COMMENT ON COLUMN site_events.restaurant_id IS 'NULL=상단 티커 전역 이벤트, 값 있음=해당 BroG 목록 카드 스티커·상세 본문';
