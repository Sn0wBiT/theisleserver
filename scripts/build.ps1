$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hudRoot = Join-Path $projectRoot "TPNIsleControlHUD"
$frontendRoot = Join-Path $hudRoot "frontend"
$buildRoot = Join-Path $hudRoot "build"
$releaseRoot = Join-Path $hudRoot "release"

$cmakeCommand = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmakeCommand) {
    $cmake = $cmakeCommand.Source
} else {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
        $visualStudioRoot = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.CMake.Project -property installationPath
        if ($visualStudioRoot) {
            $bundledCmake = Join-Path $visualStudioRoot "Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
            if (Test-Path $bundledCmake) { $cmake = $bundledCmake }
        }
    }
}

if (-not $cmake) {
    throw "CMake was not found. Install the Visual Studio C++ CMake tools or add cmake.exe to PATH."
}
Write-Host "Installing locked frontend dependencies..."
& npm --prefix $frontendRoot ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Testing TPN Isle Control HUD frontend..."
& npm --prefix $frontendRoot test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building TPN Isle Control HUD frontend..."
& npm --prefix $frontendRoot run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Configuring TPN Isle Control HUD native application..."
& $cmake -S $hudRoot -B $buildRoot -A x64
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building Release configuration..."
& $cmake --build $buildRoot --config Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Installing release to $releaseRoot..."
& $cmake --install $buildRoot --config Release --prefix $releaseRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Build complete: $releaseRoot"
