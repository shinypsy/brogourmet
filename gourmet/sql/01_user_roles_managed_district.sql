-- BroGourmet: users 역할 확장 (managed_district + admin → super_admin)
-- 대상: PostgreSQL (DATABASE_URL이 postgresql://... 일 때)
-- 적용 전 반드시 백업 권장.

BEGIN;

-- 1) 지역 담당자용 담당 구 (없으면 추가, 이미 있으면 무시)
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_district VARCHAR(50);

-- 2) 기존 'admin' 문자열을 새 역할명으로 통일
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

COMMIT;

-- --- 적용 후 확인용 (선택) ---
-- SELECT id, email, nickname, role, managed_district FROM users;

-- --- 지역 담당자 지정 예시 (이메일·구 이름은 본인 값으로 바꿔서 실행) ---
-- UPDATE users
-- SET role = 'regional_manager', managed_district = '마포구'
-- WHERE email = 'manager@example.com';

-- --- 가맹점 계정 예시 ---
-- UPDATE users SET role = 'franchise', managed_district = NULL WHERE email = 'shop@example.com';
