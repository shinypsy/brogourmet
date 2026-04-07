-- ⚠ 위험: brogourmet DB의 public 스키마 전체 삭제 후 재생성.
-- 스키마 변경(구 FK 등) 후 기존 테이블과 충돌할 때만 사용.
-- pgAdmin: brogourmet DB 선택 → Query Tool → 실행
-- 이후 uvicorn 기동 시 create_all + seed 로 테이블·샘플 재생성.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 앱 DB 유저에 권한 (로컬에서 brogourmet_user 쓰는 경우)
GRANT ALL ON SCHEMA public TO brogourmet_user;
GRANT CREATE ON SCHEMA public TO brogourmet_user;
