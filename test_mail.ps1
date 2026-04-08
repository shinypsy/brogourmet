. "$PSScriptRoot\smtp_config.ps1"
$body = "BroGourmet SMTP test mail"
$smtpLogin = $SMTP_FROM
if ($null -ne $SMTP_USER -and '' -ne [string]$SMTP_USER.Trim()) {
    $smtpLogin = $SMTP_USER.Trim()
}
$securePassword = ConvertTo-SecureString $SMTP_PASSWORD -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($smtpLogin, $securePassword)
try {
    Send-MailMessage -ErrorAction Stop -From $SMTP_FROM -To $SMTP_TO -Subject "[BroGourmet] SMTP Test" -Body $body -SmtpServer $SMTP_HOST -Port $SMTP_PORT -UseSsl -Credential $credential -Encoding UTF8
    Write-Host "OK - mail sent"
} catch {
    Write-Host ("FAIL: " + $_.Exception.Message)
    exit 1
}