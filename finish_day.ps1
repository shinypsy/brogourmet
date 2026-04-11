# 규칙4: 그날 작업 git 동기화 후 당일 일일 dial 메일 발송 (send_dial.ps1 → KST dial_YYYY-MM-dd.txt)
# 사용: 당일 dial 맨 끝에 `<N월N일 요약>` 작성 저장한 뒤  .\finish_day.ps1
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
