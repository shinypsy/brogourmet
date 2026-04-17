# 규칙4 마감 — 한 번에 끝: git 동기화 후 당일 일일 dial 메일(send_dial.ps1, KST dial_YYYY-MM-dd.txt).
# 사용 순서: (1) 일일 dial 맨 끝 `<N월N일 요약>` + 필요 시 주간 dial_MM_wN.txt `<mm-dd 요약>` 저장
#            (2) 이 스크립트만 실행 — 같은 날 send_dial·push 를 따로 반복하지 말 것(중복 방지).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) { Write-Host "Not a git repo"; exit 1 }

git add -A
$status = git status --porcelain
if ($status) {
  $msg = "Sync $(Get-Date -Format 'yyyy-MM-dd')"
  git commit -m $msg
  git push -u origin $branch
  Write-Host "Git: committed and pushed ($branch)"
} else {
  Write-Host "Git: nothing to commit"
}

& "$PSScriptRoot\send_dial.ps1"
