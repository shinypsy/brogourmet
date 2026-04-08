-- =============================================================================
-- 목적
--   시드에 쓰이던 마포 BroG 데모 6곳의 이미지 URL이 언스플래시 등에서 깨질 때,
--   아래처럼 picsum 고정 시드 URL로 갱신한다. (이름은 seed.py MAPO_BROG_DEMO_SPECS 와 동일)
--
-- 전제
--   restaurants.name 이 아래 문자열과 일치하는 행만 갱신한다. 운영에서 이름을 바꿨다면 수정 후 실행.
--
-- 실행
--   psql 등에서 트랜잭션으로 감싸 실행 후 이미지가 뜨는지 확인.
-- =============================================================================

BEGIN;

UPDATE restaurants
SET
  image_url = 'https://picsum.photos/seed/brogourmet2/480/360',
  image_urls = '["https://picsum.photos/seed/brogourmet2/480/360","https://picsum.photos/seed/brogourmet6/480/360","https://picsum.photos/seed/brogourmet0/480/360"]'::json
WHERE name = '연남동 파스타 하우스';

UPDATE restaurants
SET
  image_url = 'https://picsum.photos/seed/brogourmet3/480/360',
  image_urls = '["https://picsum.photos/seed/brogourmet3/480/360"]'::json
WHERE name = '망원 수제버거 키친';

UPDATE restaurants
SET
  image_url = 'https://picsum.photos/seed/brogourmet9/480/360',
  image_urls = '["https://picsum.photos/seed/brogourmet9/480/360"]'::json
WHERE name = '합정 돈가스 살롱';

UPDATE restaurants
SET
  image_url = 'https://picsum.photos/seed/brogourmet8/480/360',
  image_urls = '["https://picsum.photos/seed/brogourmet8/480/360"]'::json
WHERE name = '상수동 쌀국수 길';

UPDATE restaurants
SET
  image_url = 'https://picsum.photos/seed/brogourmet10/480/360',
  image_urls = '["https://picsum.photos/seed/brogourmet10/480/360"]'::json
WHERE name = 'DMC역 김치찌개 백반';

UPDATE restaurants
SET
  image_url = 'https://picsum.photos/seed/brogourmet11/480/360',
  image_urls = '["https://picsum.photos/seed/brogourmet11/480/360"]'::json
WHERE name = '홍대 입구 에그토스트';

COMMIT;
