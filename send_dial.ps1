. "$PSScriptRoot\smtp_config.ps1"

$today    = Get-Date -Format "yyyy-MM-dd"
$dialPath = "$PSScriptRoot\dial.txt"
$ipPath   = "$PSScriptRoot\IP_dial.txt"
$attachments = @()

if (-not (Test-Path $dialPath)) {
    Write-Host "dial.txt not found"
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

$securePassword = ConvertTo-SecureString $SMTP_PASSWORD -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($SMTP_FROM, $securePassword)

try {
    Send-MailMessage -From $SMTP_FROM -To $SMTP_TO -Subject "[BroGourmet] $today dial" -Body $body -Attachments $attachments -SmtpServer $SMTP_HOST -Port $SMTP_PORT -UseSsl -Credential $credential -Encoding UTF8
    Write-Host "OK - mail sent to $($SMTP_TO -join ', ')"
    if ($sendIpFile) {
        Remove-Item $ipPath -Force
        Write-Host "IP_dial.txt deleted"
    }
} catch {
    Write-Host ("FAIL: " + $_.Exception.Message)
}