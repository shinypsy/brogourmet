# 규칙4: dial 로그 수신 (고정)
# 1) gourmet/.env 와 동일 SMTP 로 보냄 (SMTP_USER 로그인 — 가입 메일과 동일)
$DialRecipients = @("shinypsy@naver.com", "shinypsy@gmail.com")
$py = Join-Path $PSScriptRoot "gourmet\.venv\Scripts\python.exe"
$mailPy = Join-Path $PSScriptRoot "gourmet\scripts\send_dial_mail.py"
if ((Test-Path $py) -and (Test-Path $mailPy)) {
    & $py $mailPy
    exit $LASTEXITCODE
}
if (Test-Path $mailPy) {
    python $mailPy
    if ($LASTEXITCODE -eq 0) { exit 0 }
    Write-Host "WARN: python send_dial_mail.py failed, trying smtp_config.ps1 ..."
}

. "$PSScriptRoot\smtp_config.ps1"

$tziKst = [System.TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
$kstTodayStr = [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tziKst).ToString("yyyy-MM-dd")
$today    = Get-Date -Format "yyyy-MM-dd"
$dialMail = if ($env:BROG_DIAL_MAIL_FILE) { $env:BROG_DIAL_MAIL_FILE.Trim() } else { "dial_$kstTodayStr.txt" }
$dialPath = "$PSScriptRoot\dial\$dialMail"
$ipPath   = "$PSScriptRoot\IP_dial.txt"
$attachments = @()

if (-not (Test-Path $dialPath)) {
    Write-Host "dial file not found: $dialPath"
    exit 1
}
$attachments += $dialPath

$sendIpFile = $false
if (Test-Path $ipPath) {
    $attachments += $ipPath
    $sendIpFile = $true
}

$body = "BroGourmet $today dial log attached."
if ($sendIpFile) { $body += " IP_dial.txt also attached (will be deleted after send)." }

# Gmail 로그인 계정은 From 과 다를 수 있음 — 반드시 SMTP_USER (gourmet/.env 와 동일 권장)
$smtpLogin = $SMTP_FROM
if ($null -ne $SMTP_USER -and '' -ne [string]$SMTP_USER.Trim()) {
    $smtpLogin = $SMTP_USER.Trim()
}
$securePassword = ConvertTo-SecureString $SMTP_PASSWORD -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($smtpLogin, $securePassword)

try {
    Send-MailMessage -ErrorAction Stop -From $SMTP_FROM -To $DialRecipients -Subject "[BroGourmet] $today dial" -Body $body -Attachments $attachments -SmtpServer $SMTP_HOST -Port $SMTP_PORT -UseSsl -Credential $credential -Encoding UTF8
    Write-Host "OK - mail sent to $($DialRecipients -join ', ')"
    if ($sendIpFile) {
        Remove-Item $ipPath -Force
        Write-Host "IP_dial.txt deleted"
    }
} catch {
    Write-Host ("FAIL: " + $_.Exception.Message)
    exit 1
}