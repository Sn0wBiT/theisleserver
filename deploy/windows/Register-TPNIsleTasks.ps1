[CmdletBinding()]
param([string]$DestinationRoot = "D:\TheIsleServer")

$ErrorActionPreference = "Stop"
$deploy = [IO.Path]::GetFullPath($DestinationRoot)
$taskRoot = Join-Path $deploy "deploy"
$dino = Join-Path $taskRoot "Start-TPNDino.cmd"
$bridge = Join-Path $taskRoot "Start-TPNBridge.cmd"

foreach ($task in @(@("TPN Dino", $dino), @("TPN Bridge", $bridge))) {
    & schtasks.exe /Create /TN $task[0] /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "cmd.exe /d /c `"$($task[1])`"" /F | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Could not register task $($task[0])" }
}

Write-Host "Registered TPN Dino and TPN Bridge startup tasks."
