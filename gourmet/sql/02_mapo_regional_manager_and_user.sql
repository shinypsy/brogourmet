-- =============================================================================
-- 마포구 지역 담당자(regional_manager) + 일반 회원(user) 추가
-- =============================================================================
-- 전제: `districts`에 이름이 '마포구'인 행이 있어야 합니다(시드 또는 수동 등록).
--
-- 평문 비밀번호(로그인 테스트용 — 운영에서는 반드시 변경):
--   지역 담당자: MapoMgr123!
--   일반 회원:   UserTest123!
--
-- 이메일 인증이 켜진 환경에서도 바로 로그인되도록 `email_verified_at`을 채웁니다.
--
-- PostgreSQL: 아래 "PostgreSQL" 블록만 실행.
-- SQLite:     파일 맨 아래 "SQLite" 블록 참고.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PostgreSQL
-- ---------------------------------------------------------------------------
BEGIN;

INSERT INTO users (
    email,
    password_hash,
    nickname,
    role,
    managed_district_id,
    email_verified_at,
    is_active,
    created_at,
    updated_at
)
SELECT
    'mapo.manager@example.local',
    '$2b$12$27KAF5ckr6ahobdoqP7X1Oh/dgBcnF4hOQlrP./HQaeAdte4zx5lq',
    '마포담당자',
    'regional_manager',
    d.id,
    NOW(),
    TRUE,
    NOW(),
    NOW()
FROM districts d
WHERE d.name = '마포구'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (
    email,
    password_hash,
    nickname,
    role,
    managed_district_id,
    email_verified_at,
    is_active,
    created_at,
    updated_at
) VALUES (
    'mapo.user@example.local',
    '$2b$12$cbuXp0wOhYQC13WPF64GxumkRGMuSfCoiOtyWoCrc2azwd3ItYcFy',
    '마포일반회원',
    'user',
    NULL,
    NOW(),
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

COMMIT;

-- 확인
-- SELECT id, email, nickname, role, managed_district_id FROM users
-- WHERE email IN ('mapo.manager@example.local', 'mapo.user@example.local');


-- ---------------------------------------------------------------------------
-- SQLite (로컬 등) — 위 PostgreSQL 블록과 동시에 실행하지 마세요.
-- ---------------------------------------------------------------------------
-- BEGIN TRANSACTION;
--
-- INSERT OR IGNORE INTO users (
--     email,
--     password_hash,
--     nickname,
--     role,
--     managed_district_id,
--     email_verified_at,
--     is_active,
--     created_at,
--     updated_at
-- )
-- SELECT
--     'mapo.manager@example.local',
--     '$2b$12$27KAF5ckr6ahobdoqP7X1Oh/dgBcnF4hOQlrP./HQaeAdte4zx5lq',
--     '마포담당자',
--     'regional_manager',
--     d.id,
--     datetime('now'),
--     1,
--     datetime('now'),
--     datetime('now')
-- FROM districts d
-- WHERE d.name = '마포구';
--
-- INSERT OR IGNORE INTO users (
--     email,
--     password_hash,
--     nickname,
--     role,
--     managed_district_id,
--     email_verified_at,
--     is_active,
--     created_at,
--     updated_at
-- ) VALUES (
--     'mapo.user@example.local',
--     '$2b$12$cbuXp0wOhYQC13WPF64GxumkRGMuSfCoiOtyWoCrc2azwd3ItYcFy',
--     '마포일반회원',
--     'user',
--     NULL,
--     datetime('now'),
--     1,
--     datetime('now'),
--     datetime('now')
-- );
--
-- COMMIT;
