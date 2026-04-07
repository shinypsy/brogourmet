-- [1단계] 슈퍼유저로 DB `postgres` 에 접속 후 실행.
-- 이미 있으면 해당 문장만 건너뛰기.

CREATE USER brogourmet_user WITH LOGIN PASSWORD '1234';

CREATE DATABASE brogourmet OWNER brogourmet_user;
