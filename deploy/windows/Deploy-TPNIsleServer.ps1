[CmdletBinding()]
param(
    [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")),
    [string]$DestinationRoot = "D:\TheIsleServer",
    [string]$NodeExe = "",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$SourceRoot = (Resolve-Path $SourceRoot).Path
$DestinationRoot = [IO.Path]::GetFullPath($DestinationRoot)
$npm = if ($NodeExe) { Join-Path (Split-Path $NodeExe) "npm.cmd" } else { "npm.cmd" }

function Copy-Tree([string]$from, [string]$to) {
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    & robocopy $from $to /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "robocopy failed ($LASTEXITCODE): $from -> $to" }
}

$dino = Join-Path $SourceRoot "tpn-dino"
$bridge = Join-Path $SourceRoot "TPNIsleControl\bridge"
$node = if ($NodeExe) { $NodeExe } else { Join-Path $SourceRoot "TPNIsleControl\runtime\node\node.exe" }

if (-not $SkipBuild) {
    Push-Location $dino
    try {
        & $npm ci
        if ($LASTEXITCODE -ne 0) { throw "tpn-dino npm ci failed" }
        & $npm run build -- --webpack
        if ($LASTEXITCODE -ne 0) { throw "tpn-dino build failed" }
    } finally { Pop-Location }
}

if (-not (Test-Path (Join-Path $dino ".next\standalone\server.js"))) {
    throw "Missing .next\standalone\server.js. Run without -SkipBuild first."
}
if (-not (Test-Path $node)) { throw "Missing Node runtime: $node" }

$app = Join-Path $DestinationRoot "apps\tpn-dino"
$bridgeTarget = Join-Path $DestinationRoot "TPNIsleControl\bridge"
New-Item -ItemType Directory -Force -Path (Join-Path $DestinationRoot "config"), (Join-Path $DestinationRoot "logs"), (Join-Path $DestinationRoot "deploy") | Out-Null
Copy-Tree (Join-Path $dino ".next\standalone") $app
Copy-Tree (Join-Path $dino ".next\static") (Join-Path $app ".next\static")
Copy-Tree (Join-Path $dino "public") (Join-Path $app "public")

Copy-Tree (Join-Path $bridge "src") (Join-Path $bridgeTarget "src")
Copy-Tree (Join-Path $bridge "sql") (Join-Path $bridgeTarget "sql")
Copy-Item (Join-Path $bridge "package.json") (Join-Path $bridgeTarget "package.json") -Force
Copy-Item (Join-Path $bridge "package-lock.json") (Join-Path $bridgeTarget "package-lock.json") -Force
Copy-Item (Join-Path $bridge "quests.json") (Join-Path $bridgeTarget "quests.json") -Force
Copy-Item (Join-Path $bridge "ai-dinosaurs.json") (Join-Path $bridgeTarget "ai-dinosaurs.json") -Force
Copy-Item (Join-Path $SourceRoot "deploy\windows\Start-TPN*.cmd") (Join-Path $DestinationRoot "deploy") -Force
Copy-Item (Join-Path $SourceRoot "deploy\windows\Register-TPNIsleTasks.ps1") (Join-Path $DestinationRoot "deploy") -Force
Copy-Item (Join-Path $SourceRoot "deploy\windows\tpn-dino.env.example") (Join-Path $DestinationRoot "config\tpn-dino.env.example") -Force

if (-not (Test-Path (Join-Path $DestinationRoot "config\bridge.json"))) {
    Copy-Item (Join-Path $bridge "config.example.json") (Join-Path $DestinationRoot "config\bridge.json")
}
if (-not (Test-Path (Join-Path $DestinationRoot "config\tpn-dino.env"))) {
    Copy-Item (Join-Path $DestinationRoot "config\tpn-dino.env.example") (Join-Path $DestinationRoot "config\tpn-dino.env")
}

Push-Location $bridgeTarget
try {
    & (Join-Path (Split-Path $node) "npm.cmd") ci --omit=dev --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "bridge npm ci failed" }
} finally { Pop-Location }

Write-Host "Deployment runtime copied to $DestinationRoot"
Write-Host "Edit config\tpn-dino.env and config\bridge.json before starting services."
