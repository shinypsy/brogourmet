# KST 기준:
# - 당일 일일 dial 파일 dial_YYYY-MM-dd.txt 없으면 껍데기 생성
# - 해당 월 dial_MM_wN.txt · dial_MM_month.txt 없으면 껍데기 생성
# 사용: 저장소 루트에서 .\scripts\dial_auto.ps1   또는  -WhatIf
param(
    [switch] $WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
        Set-Content -LiteralPath $dailyPath -Value $dailyBody.TrimEnd() -Encoding UTF8
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
${year}년 ${month}월 제${wN}주 (KST 약 ${month}/${weekStart}–${weekEnd}) — 일일 dial_YYYY-MM-dd 요약을 날짜별로 쌓는다. w1에는 최종본을 향한 주요 변경·방향 이슈(재논의 필요)를 특히 남긴다.

--- 본문 ---

"@
    if ($WhatIf) { Write-Host "[WhatIf] Would create $weekPath" }
    else {
        Set-Content -LiteralPath $weekPath -Value $body.TrimEnd() -Encoding UTF8
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
${year}년 ${month}월 월간 핵심 — 같은 달 w1~w5 주간 파일 핵심만 압축.

--- 본문 ---

"@
    if ($WhatIf) { Write-Host "[WhatIf] Would create $monthPath" }
    else {
        Set-Content -LiteralPath $monthPath -Value $mbody.TrimEnd() -Encoding UTF8
        Write-Host "Created monthly file: $(Split-Path $monthPath -Leaf)"
    }
}
else {
    Write-Host "Monthly file exists: dial_${mm}_month.txt"
}
