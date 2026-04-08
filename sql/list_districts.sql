-- =============================================================================
-- 목적
--   BroG 서비스의 구(districts) 목록과 id를 확인한다. 지역 담당자(regional_manager)
--   배정 시 managed_district_id 에 넣을 값을 고를 때 사용한다.
--
-- 실행
--   PostgreSQL 클라이언트에서 본 파일 또는 아래 SELECT 만 실행.
--
-- 관련
--   users.managed_district_id → districts.id (FK)
-- =============================================================================

SELECT id, name
FROM districts
ORDER BY id;
