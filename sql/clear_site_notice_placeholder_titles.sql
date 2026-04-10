-- 목적: `site_notices`에 예전 기본 라벨만 들어가 있어 홈에 빈 공지처럼 보이는 행 정리(선택).
-- 실행 전제/주의: gourmet DB에 `site_notices` 테이블이 있어야 함. 운영 전 백업 권장.
-- 실행 방법: psql/SQLite 클라이언트 등으로 해당 DB에 연결 후 실행. 필요한 슬롯만 골라 실행 가능.
-- 관련 테이블: site_notices (slot PK, title, body, updated_at)

-- 본문이 비어 있고 제목이 슬롯 라벨('공지 1','공지1' 등)뿐이면 제목을 비움 → 홈에서 슬롯 미노출
UPDATE site_notices
SET title = ''
WHERE TRIM(body) = ''
  AND (
    REPLACE(TRIM(title), ' ', '') = '공지1' AND slot = 1
    OR REPLACE(TRIM(title), ' ', '') = '공지2' AND slot = 2
    OR REPLACE(TRIM(title), ' ', '') = '공지3' AND slot = 3
  );
