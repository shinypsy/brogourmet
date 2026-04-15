# KST 기준:
# - 당일 일일 dial 파일 dial_YYYY-MM-dd.txt 없으면 껍데기 생성
# - 해당 월 dial_MM_wN.txt · dial_MM_month.txt 없으면 껍데기 생성
# 사용: 저장소 루트에서 .\scripts\dial_auto.ps1   또는  -WhatIf
#
# 인코딩: 이 스크립트는 UTF-8(BOM)으로 저장함. Windows PowerShell 5.1은 무 BOM UTF-8을
#         시스템 코드페이지로 읽어 한글 here-string이 깨질 수 있음.
# 출력: dial/*.txt 는 UTF-8 무 BOM(.NET WriteAllText).
param(
    [switch] $WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-DialUtf8File {
    param(
        [Parameter(Mandatory)][string] $LiteralPath,
        [Parameter(Mandatory)][string] $Content
    )
    $enc = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($LiteralPath, $Content, $enc)
}

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$tzi = [System.TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
function Get-KstNow { [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tzi) }
function Get-KstDate { (Get-KstNow).Date }

$kstToday = Get-KstDate
$kstDateStr = $kstToday.ToString("yyyy-MM-dd")
$dialDir = Join-Path $repoRoot "dial"
if (-not (Test-Path $dialDir)) {
    if ($WhatIf) { Write-Host "[WhatIf] Would create directory: $dialDir" }
    else { New-Item -ItemType Directory -Path $dialDir | Out-Null }
}

# --- 일일: dial_YYYY-MM-dd.txt ---
$dailyPath = Join-Path $dialDir ("dial_{0}.txt" -f $kstDateStr)
if (-not (Test-Path $dailyPath)) {
    $dailyBody = @"
BroGourmet dial_${kstDateStr}.txt
KST ${kstDateStr} — 일일 대화. 규칙·확정 목록은 월 스냅샷(예: 4월 dial_0411.txt) 참고. 맨 끝에만 Gee:/브로(AI): 추가.

--- 본문 ---

"@
    if ($WhatIf) { Write-Host "[WhatIf] Would create $dailyPath" }
    else {
        Write-DialUtf8File -LiteralPath $dailyPath -Content $dailyBody.TrimEnd()
        Write-Host "Created daily file: $(Split-Path $dailyPath -Leaf)"
    }
}
else {
    Write-Host "Daily file exists: dial_${kstDateStr}.txt"
}

$month = $kstToday.Month
$year = $kstToday.Year
$day = $kstToday.Day
$wN = [math]::Min(5, [math]::Max(1, [int][math]::Ceiling($day / 7.0)))
$weekStart = ($wN - 1) * 7 + 1
$weekEnd = [math]::Min($wN * 7, [datetime]::DaysInMonth($year, $month))
$mm = $month.ToString("00")

# --- 주간: dial_MM_wN.txt ---
$weekPath = Join-Path $dialDir ("dial_{0}_w{1}.txt" -f $mm, $wN)
if (-not (Test-Path $weekPath)) {
    $body = @"
BroGourmet dial_${mm}_w${wN}.txt
${year}년 ${month}월 제${wN}주 (KST 약 ${month}/${weekStart}–${weekEnd}) — 당일 요약은 <mm-dd 요약> 블록으로 쌓는다. 최종본(제품) 변경·이슈는 주간본에 기록(dial/dial_MMDD.txt 규칙1).

--- 본문 ---

"@
    if ($WhatIf) { Write-Host "[WhatIf] Would create $weekPath" }
    else {
        Write-DialUtf8File -LiteralPath $weekPath -Content $body.TrimEnd()
        Write-Host "Created weekly file: $(Split-Path $weekPath -Leaf)"
    }
}
else {
    Write-Host "Weekly file exists: dial_${mm}_w${wN}.txt"
}

# --- 월간: dial_MM_month.txt ---
$monthPath = Join-Path $dialDir ("dial_{0}_month.txt" -f $mm)
if (-not (Test-Path $monthPath)) {
    $mbody = @"
BroGourmet dial_${mm}_month.txt
${year}년 ${month}월 월간 — 주간본(w1, w2, ...) 종합. 최종본 이슈 보관·압축(dial/dial_MMDD.txt 규칙1).

--- 본문 ---

"@
    if ($WhatIf) { Write-Host "[WhatIf] Would create $monthPath" }
    else {
        Write-DialUtf8File -LiteralPath $monthPath -Content $mbody.TrimEnd()
        Write-Host "Created monthly file: $(Split-Path $monthPath -Leaf)"
    }
}
else {
    Write-Host "Monthly file exists: dial_${mm}_month.txt"
}
