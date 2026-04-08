-- =============================================================================
-- 목적
--   이미 가입된 사용자 한 명을 regional_manager 로 바꾸고, 담당 구(district)를 연결한다.
--   가입 API는 role 을 항상 user 로만 두므로, 지역 담당 승격은 DB 수동 작업으로 한다.
--
-- 전제
--   해당 email 의 users 행이 존재한다. districts 에 유효한 id 가 있다.
--
-- 주의
--   managed_district_id 는 반드시 districts.id 와 일치해야 한다. 먼저 list_districts.sql 로 id 를 확인한다.
--   super_admin 승격은 보통 SUPER_ADMIN_EMAIL·db_migrate 등 별도 흐름을 쓴다.
--
-- 실행
--   아래 UPDATE 의 이메일·managed_district_id 를 실제 값으로 바꾼 뒤 한 번에 실행한다.
-- =============================================================================

UPDATE users
SET
  role = 'regional_manager',
  managed_district_id = 1  -- TODO: list_districts.sql 로 확인한 districts.id 로 교체
WHERE lower(email) = lower('manager@example.com');  -- TODO: 실제 담당자 이메일로 교체
