-- [2단계] 슈퍼유저로 DB `brogourmet` 에 접속한 뒤 실행 (권한 이슈 방지).

GRANT ALL ON SCHEMA public TO brogourmet_user;
GRANT CREATE ON SCHEMA public TO brogourmet_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO brogourmet_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO brogourmet_user;
