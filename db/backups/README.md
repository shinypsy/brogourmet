# PostgreSQL 백업 덤프 (git 보관용)

## 목적

로컬·개발 DB 스냅샷을 **평문 SQL**로 남겨 두고, 필요 시 같은 스키마 DB에 복원하기 위함.

## 주의

- 덤프에는 **사용자·게시글·해시된 비밀번호 등 운영 데이터**가 그대로 들어갈 수 있음.
- **공개 저장소**에 올리기 전에 민감도·법적·정책 검토.
- `gourmet/.env`의 `DATABASE_URL`은 **git에 넣지 않음** (`.gitignore`).

## 만들기

저장소 루트에서:

```powershell
.\scripts\backup_postgres_for_git.ps1
```

- `gourmet/.env`의 `DATABASE_URL`을 읽어 `pg_dump` 실행.
- 결과: `db/backups/brogourmet_YYYY-MM-dd_HHmmss.sql`
- **PostgreSQL 클라이언트**(`pg_dump`)가 PATH에 있어야 함 (설치 시 "Command Line Tools" 포함).

## 복원 (예시)

```powershell
# .env 에서 DATABASE_URL 로드한 뒤
psql $env:DATABASE_URL -f db/backups/brogourmet_2026-04-10_120000.sql
```

또는 빈 DB에 URL 지정:

```powershell
psql "postgresql://user:pass@localhost:5432/brogourmet" -f db/backups/brogourmet_2026-04-10_120000.sql
```

## git

```powershell
git add db/backups/brogourmet_*.sql db/backups/README.md scripts/backup_postgres_for_git.ps1
git commit -m "db: PostgreSQL backup snapshot"
git push
```

오래된 스냅샷은 수동으로 정리해도 됨.
