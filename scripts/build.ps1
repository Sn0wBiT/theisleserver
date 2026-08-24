$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hudRoot = Join-Path $projectRoot "TPNIsleControlHUD"
$frontendRoot = Join-Path $hudRoot "frontend"
$buildRoot = Join-Path $hudRoot "build"
$releaseRoot = Join-Path $hudRoot "release"

Write-Host "Building TPN Isle Control HUD frontend..."
& npm --prefix $frontendRoot ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& npm --prefix $frontendRoot run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Configuring TPN Isle Control HUD native application..."
& cmake -S $hudRoot -B $buildRoot -A x64
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building Release configuration..."
& cmake --build $buildRoot --config Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Installing release to $releaseRoot..."
& cmake --install $buildRoot --config Release --prefix $releaseRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Build complete: $releaseRoot"
