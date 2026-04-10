# PostgreSQL 전체 덤프 → db/backups/brogourmet_<타임스탬프>.sql
# 전제: gourmet/.env 에 DATABASE_URL, PATH 에 pg_dump
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $Root "gourmet\.env"
$OutDir = Join-Path $Root "db\backups"

if (-not (Test-Path $EnvPath)) {
    Write-Error "gourmet\.env 가 없습니다. DATABASE_URL 을 설정한 뒤 다시 실행하세요."
}

$databaseUrl = $null
Get-Content -LiteralPath $EnvPath -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq '') { return }
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
        $databaseUrl = $matches[1].Trim().Trim('"').Trim("'")
    }
}

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Write-Error "gourmet\.env 에 DATABASE_URL=... 줄이 없습니다."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump 를 찾을 수 없습니다. PostgreSQL 클라이언트를 설치하고 bin 을 PATH 에 넣으세요."
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile = Join-Path $OutDir "brogourmet_$stamp.sql"

Write-Host "Dumping to $outFile ..."
# 이식성: 소유자·ACL 생략. 연결 문자열은 --dbname= 로만 넘김(Win에서 위치 인자와 옵션 충돌 방지)
& pg_dump --no-owner --no-acl --encoding=UTF8 -f $outFile --dbname=$databaseUrl
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump 실패 (exit $LASTEXITCODE)"
}

$size = (Get-Item $outFile).Length
Write-Host "OK — $outFile ($size bytes)"
Write-Host "다음: git add `"$outFile`" 후 커밋·푸시"
