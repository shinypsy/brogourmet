-- 목적: `restaurants.bro_list_pin`에 **단독** UNIQUE가 걸려 있으면 DB 전체에서 pin이 1개만 허용되어, 같은 구 안에 1~4위 고정을 동시에 둘 수 없다. 그 제약·인덱스를 제거한다.
-- 실행 전제/주의: PostgreSQL 권장. 백엔드 부팅 시 `db_migrate.ensure_bro_list_pin_not_globally_unique()`가 같은 취지로 자동 시도한다. 수동 실행 전 백업 권장.
-- 실행 방법: (1) psql 등에서 아래 조회·DROP 수동 실행, 또는 (2) 백엔드 기동 전 환경변수 `BROG_REPAIR_BRO_LIST_PIN_UNIQUE=1` 로 한 번만 기동해 자동 제거(`db_migrate.ensure_bro_list_pin_not_globally_unique`). 평소 자동 실행은 하지 않음.
-- 관련: `gourmet/app/db_migrate.py` `ensure_bro_list_pin_not_globally_unique`, `gourmet/app/main.py`, `gourmet/app/api/restaurants.py` `cycle_bro_list_pin`

-- PostgreSQL: restaurants 테이블의 bro_list_pin 관련 UNIQUE 인덱스 정의 확인
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'restaurants' AND indexdef ILIKE '%bro_list_pin%';

-- 예시(이름은 조회 결과로 바꿀 것): 단독 컬럼 bro_list_pin만 있는 UNIQUE 인덱스
-- DROP INDEX IF EXISTS 잘못된_인덱스_이름;

-- 테이블 UNIQUE 제약으로만 걸린 경우
-- ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS 잘못된_제약_이름;

-- 올바른 형태(선택): 구별로 슬롯 1개만 — 필요 시에만 생성 (현재는 API가 충돌 시 NULL 처리)
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurants_district_bro_list_pin
--   ON restaurants (district_id, bro_list_pin)
--   WHERE bro_list_pin IS NOT NULL;
