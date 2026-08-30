param(
  [string]$Version = "1.9.12",
  [string]$DestinationRoot = "D:\TheIsleServer",
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9.-]+$')]
  [string]$VoiceDomain,
  [switch]$RegenerateConfig
)
$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw "Run as Administrator" }
$archiveName = "livekit_${Version}_windows_amd64.zip"
$release = "https://github.com/livekit/livekit/releases/download/v$Version"
$temporary = Join-Path ([IO.Path]::GetTempPath()) "tpn-livekit-$Version"
New-Item -ItemType Directory -Force $temporary | Out-Null
$archive = Join-Path $temporary $archiveName
$checksums = Join-Path $temporary "checksums.txt"
Invoke-WebRequest "$release/$archiveName" -OutFile $archive
Invoke-WebRequest "$release/checksums.txt" -OutFile $checksums
$expected = (Get-Content $checksums | Where-Object { $_ -match [regex]::Escape($archiveName) } | Select-Object -First 1) -split '\s+' | Select-Object -First 1
if (-not $expected) { throw "Pinned release checksum is missing for $archiveName" }
$actual = (Get-FileHash -Algorithm SHA256 $archive).Hash.ToLowerInvariant()
if ($actual -ne $expected.ToLowerInvariant()) { throw "LiveKit checksum mismatch" }
$install = Join-Path $DestinationRoot "services\livekit-$Version"
New-Item -ItemType Directory -Force $install | Out-Null
Expand-Archive -Force $archive $install
$config = Join-Path $DestinationRoot "config\livekit.yaml"
if ($RegenerateConfig -and (Test-Path $config)) {
  # Recover a file whose previous ACL prevents replacement, then rotate it.
  & takeown.exe /F $config /A | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to take ownership of damaged config: $config" }
  & icacls.exe $config /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to recover ACLs on damaged config: $config" }
}
if ($RegenerateConfig -or -not (Test-Path $config)) {
  $configDirectory = Split-Path -Parent $config
  New-Item -ItemType Directory -Force $configDirectory | Out-Null
  $apiKeyBytes = New-Object byte[] 12
  $apiSecretBytes = New-Object byte[] 36
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $random.GetBytes($apiKeyBytes)
    $random.GetBytes($apiSecretBytes)
  } finally {
    $random.Dispose()
  }
  $apiKey = "TPN" + (($apiKeyBytes | ForEach-Object { $_.ToString("x2") }) -join "")
  $apiSecret = [Convert]::ToBase64String($apiSecretBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $content = @"
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  port_range_start: 50000
  port_range_end: 50150
  tcp_port: 7881
  use_external_ip: true
turn:
  enabled: true
  tls_port: 5349
  domain: "$VoiceDomain"
  cert_file: 'C:\caddy\data\certificates\voice.crt'
  key_file: 'C:\caddy\data\certificates\voice.key'
keys:
  "$apiKey": "$apiSecret"
logging:
  level: info
room:
  auto_create: true
"@
  $temporaryConfig = "$config.tmp"
  [IO.File]::WriteAllText($temporaryConfig, $content + "`r`n", (New-Object Text.UTF8Encoding($false)))
  $rendered = [IO.File]::ReadAllText($temporaryConfig)
  if ($rendered.IndexOf([char]0) -ge 0 -or $rendered -notmatch '(?m)^keys:\s*$' -or
      $rendered -notmatch '(?m)^\s+"TPN[0-9a-f]{24}":\s+"[A-Za-z0-9_-]{48}"\s*$') {
    Remove-Item -LiteralPath $temporaryConfig -Force -ErrorAction SilentlyContinue
    throw "Generated LiveKit YAML failed validation"
  }
  Move-Item -LiteralPath $temporaryConfig -Destination $config -Force
  Write-Host "Created LiveKit config with generated credentials: $config"
}

# Remove inherited access and allow only LocalSystem and built-in Administrators.
& icacls.exe $config /inheritance:r /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to restrict ACLs on $config" }
$configText = [IO.File]::ReadAllText($config)
if ($configText.IndexOf([char]0) -ge 0 -or $configText.Contains("CHANGE_ME") -or $configText.Contains("voice.example.com") -or
    $configText -notmatch '(?m)^keys:\s*$') {
  throw "Replace placeholder credentials/domain in $config before installing the task"
}
$action = New-ScheduledTaskAction -Execute (Join-Path $install "livekit-server.exe") -Argument "--config `"$config`"" -WorkingDirectory $install
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "TPN-LiveKit" -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Remove-Item -Recurse -Force $temporary
Write-Host "Installed checksum-verified LiveKit v$Version with protected config."
Write-Host "Copy the generated key and secret from $config into config\tpn-dino.env as LIVEKIT_API_KEY and LIVEKIT_API_SECRET."
Write-Host "Set LIVEKIT_WS_URL=wss://$VoiceDomain and start with: Start-ScheduledTask -TaskName TPN-LiveKit"
