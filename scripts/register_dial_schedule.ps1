# Windows 작업 스케줄러에 매일 KST 자정 직후(로컬 00:05) dial_auto.ps1 등록.
# 관리자 권한 불필요(현재 사용자 계정으로 실행).
# PC 표준 시간대가 서울이 아니면, 트리거 시각을 KST에 맞게 수동 조정할 것.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $PSScriptRoot "dial_auto.ps1"
if (-not (Test-Path $scriptPath)) { throw "Missing: $scriptPath" }

$taskName = "BroGourmet_dial_auto"
$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

Import-Module ScheduledTasks -ErrorAction Stop
Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At "12:05AM"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description "BroGourmet: dial\ 일일 dial_YYYY-MM-dd + 주간·월간 껍데기 (scripts/dial_auto.ps1)"

Write-Host "Registered scheduled task: $taskName (daily 00:05 local time, cwd $repoRoot)"
Write-Host "Unregister: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
