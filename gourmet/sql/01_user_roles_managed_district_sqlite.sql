-- BroGourmet: users 역할 확장 (SQLite 로컬 개발용)
-- SQLite 3.35.0 이상에서 ADD COLUMN IF NOT EXISTS 지원.
-- 이미 컬럼이 있으면 1번은 스킵되고, 그보다 낮은 버전이면 수동으로 한 번만 실행해야 함.

BEGIN TRANSACTION;

ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_district VARCHAR(50);

UPDATE users SET role = 'super_admin' WHERE role = 'admin';

COMMIT;
