# PostgreSQL 로컬에 brogourmet DB / brogourmet_user 생성 (테스트용)
# 사전: PostgreSQL 설치, 서비스 기동, 슈퍼유저 postgres 비밀번호 필요
#
# 사용 예 (postgres 비밀번호를 환경변수로):
#   $env:PGPASSWORD = 'postgres슈퍼유저비번'
#   .\scripts\init_postgres.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

$superUrl = if ($env:POSTGRES_SUPER_URL) { $env:POSTGRES_SUPER_URL } else { 'postgresql://postgres@localhost:5432/postgres' }

Write-Host "1) postgres DB에서 유저/DB 생성: $superUrl"
psql $superUrl -f sql/00_create_role_and_database.sql

Write-Host "2) brogourmet DB에서 public 권한 부여"
$brogUrl = $superUrl -replace '/postgres$', '/brogourmet'
psql $brogUrl -f sql/00_grant_public_schema.sql

Write-Host "3) 역할 마이그레이션 SQL (선택)"
psql "postgresql://brogourmet_user:1234@localhost:5432/brogourmet" -f sql/01_user_roles_managed_district.sql

Write-Host "완료. 백엔드 기동 시 create_all 로 테이블 생성됨."
