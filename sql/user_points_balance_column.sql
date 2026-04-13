-- 목적: 회원 포인트 잔액 컬럼(앱 부팅 시 `db_migrate.ensure_user_points_balance_column`와 동일). 수동 보강·검증용.
-- 실행 전제/주의: gourmet DB `users` 테이블. 이미 있으면 무시(IF NOT EXISTS).
-- 실행 방법: psql 등에서 gourmet DB 선택 후 실행.
-- 관련 테이블: users.points_balance — BroG 신규 등록(`points_eligible`) 시 일반 100 · regional_manager 200 가산(`gourmet/app/api/restaurants.py`).

ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;
