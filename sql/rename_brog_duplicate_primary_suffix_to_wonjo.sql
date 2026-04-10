-- 목적: BroG 중복 그룹에서 **첫 등록** 매장 이름 끝의 레거시 접미사 `_*`를 새 표기 `(원조!!!)`로 바꾼다(`gourmet/app/api/restaurants.py` `DUPLICATE_GROUP_PRIMARY_NAME_SUFFIX`와 맞춤).
-- 실행 전제/주의: **이름이 정말로 시스템이 붙인 `_*`인 행만** 대상으로 할 것. 사용자가 상호 끝에 `_*`를 직접 쓴 경우는 드물지만, 실행 전 `SELECT id, name FROM restaurants WHERE name LIKE '%\_*' ESCAPE '\'` 등으로 확인 권장. 백업 후 실행.
-- 실행 방법: PostgreSQL 예시. 다른 DB는 문자열 함수에 맞게 수정.
-- 관련 테이블·컬럼: `restaurants.name` (VARCHAR 200)

-- 미리보기(실제 갱신 전)
-- SELECT id, name AS before_name, left(name, length(name) - 2) || '(원조!!!)' AS after_name
-- FROM restaurants
-- WHERE name LIKE '%\_*' ESCAPE '\'
--   AND right(name, 2) = '_*'
--   AND is_deleted = false;

-- UPDATE restaurants
-- SET name = left(name, length(name) - 2) || '(원조!!!)'
-- WHERE name LIKE '%\_*' ESCAPE '\'
--   AND right(name, 2) = '_*'
--   AND is_deleted = false;
