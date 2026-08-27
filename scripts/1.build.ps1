$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hudRoot = Join-Path $projectRoot "TPNIsleControlHUD"
$frontendRoot = Join-Path $hudRoot "frontend"
$buildRoot = Join-Path $hudRoot "build"
$releaseRoot = Join-Path $hudRoot "release"
$configPath = Join-Path $hudRoot "native\src\config\Config.hpp"
$dinoPublicRoot = Join-Path $projectRoot "tpn-dino\public"

function ConvertFrom-CppString {
    param([string]$Value)
    return $Value.Replace('\"', '"').Replace('\\', '\')
}

function ConvertTo-CppWideString {
    param([string]$Value)
    return 'L"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Read-StringSetting {
    param([string]$Label, [string]$CurrentValue)
    $value = Read-Host "$Label [$CurrentValue]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $CurrentValue }
    return $value.Trim()
}

function Read-BooleanSetting {
    param([string]$Label, [bool]$CurrentValue)
    while ($true) {
        $value = Read-Host "$Label [$($CurrentValue.ToString().ToLowerInvariant())]"
        if ([string]::IsNullOrWhiteSpace($value)) { return $CurrentValue }
        if ($value -ieq "true") { return $true }
        if ($value -ieq "false") { return $false }
        Write-Warning "Enter true, false, or press Enter to keep the current value."
    }
}

function Update-NativeConfig {
    $source = [System.IO.File]::ReadAllText($configPath)
    $updated = $source
    $newLine = if ($source.Contains("`r`n")) { "`r`n" } else { "`n" }

    $developmentMatch = [regex]::Match($source, 'const bool development\{(true|false)\};')
    $devToolsMatch = [regex]::Match($source, 'const bool enableDevTools\{(true|false)\};')
    $devUrlMatch = [regex]::Match($source, 'const std::wstring frontendDevUrl\{L"((?:\\.|[^"])*)"\};')
    $apiOriginMatch = [regex]::Match($source, 'const std::wstring apiOrigin\{L"((?:\\.|[^"])*)"\};')
    $hotkeyMatch = [regex]::Match($source, 'const std::wstring overlayHotkey\{L"((?:\\.|[^"])*)"\};')
    $executablesMatch = [regex]::Match($source, '(?s)const std::vector<std::wstring> gameExecutables\{(?<values>.*?)\n\s*\};')
    if (-not ($developmentMatch.Success -and $devToolsMatch.Success -and $devUrlMatch.Success -and
              $apiOriginMatch.Success -and $hotkeyMatch.Success -and $executablesMatch.Success)) {
        throw "Unable to read native settings from $configPath."
    }

    $development = Read-BooleanSetting "Development mode" ($developmentMatch.Groups[1].Value -eq "true")
    $enableDevTools = Read-BooleanSetting "Enable CEF DevTools" ($devToolsMatch.Groups[1].Value -eq "true")
    $frontendDevUrl = Read-StringSetting "Frontend development URL" (ConvertFrom-CppString $devUrlMatch.Groups[1].Value)
    $apiOrigin = Read-StringSetting "API origin" (ConvertFrom-CppString $apiOriginMatch.Groups[1].Value)
    $overlayHotkey = Read-StringSetting "Overlay hotkey" (ConvertFrom-CppString $hotkeyMatch.Groups[1].Value)

    $currentExecutables = @(
        [regex]::Matches($executablesMatch.Groups['values'].Value, 'L"((?:\\.|[^"])*)"') |
            ForEach-Object { ConvertFrom-CppString $_.Groups[1].Value }
    )
    while ($true) {
        $executableInput = Read-Host "Game executables, comma-separated [$($currentExecutables -join ', ')]"
        if ([string]::IsNullOrWhiteSpace($executableInput)) {
            $gameExecutables = $currentExecutables
            break
        }
        $gameExecutables = @($executableInput.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        if ($gameExecutables.Count -gt 0) { break }
        Write-Warning "Enter at least one executable or press Enter to keep the current list."
    }

    $updated = [regex]::Replace($updated, 'const bool development\{(?:true|false)\};',
        "const bool development{$($development.ToString().ToLowerInvariant())};")
    $updated = [regex]::Replace($updated, 'const bool enableDevTools\{(?:true|false)\};',
        "const bool enableDevTools{$($enableDevTools.ToString().ToLowerInvariant())};")
    $updated = [regex]::Replace($updated, 'const std::wstring frontendDevUrl\{L"(?:\\.|[^"])*"\};',
        "const std::wstring frontendDevUrl{$(ConvertTo-CppWideString $frontendDevUrl)};")
    $updated = [regex]::Replace($updated, 'const std::wstring apiOrigin\{L"(?:\\.|[^"])*"\};',
        "const std::wstring apiOrigin{$(ConvertTo-CppWideString $apiOrigin)};")
    $updated = [regex]::Replace($updated, 'const std::wstring overlayHotkey\{L"(?:\\.|[^"])*"\};',
        "const std::wstring overlayHotkey{$(ConvertTo-CppWideString $overlayHotkey)};")

    $executableLines = $gameExecutables | ForEach-Object { "        $(ConvertTo-CppWideString $_)" }
    $executablesBlock = "const std::vector<std::wstring> gameExecutables{$newLine" +
        ($executableLines -join ",$newLine") + "$newLine    };"
    $updated = [regex]::Replace($updated,
        '(?s)const std::vector<std::wstring> gameExecutables\{.*?\n\s*\};', $executablesBlock)

    if ($updated -ceq $source) {
        Write-Host "Native configuration unchanged; using current defaults."
        return
    }

    [System.IO.File]::WriteAllText($configPath, $updated, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Updated compiled native configuration: $configPath"
}

function Publish-HudRelease {
    $resolvedReleaseRoot = (Resolve-Path $releaseRoot).Path.TrimEnd('\')
    $files = Get-ChildItem -Path $resolvedReleaseRoot -File -Recurse |
        Where-Object { $_.Name -ne "manifest.json" -and $_.Name -ne "TPNIsleControlHUD.log" } |
        ForEach-Object {
            $relative = $_.FullName.Substring($resolvedReleaseRoot.Length + 1).Replace('\', '/')
            [pscustomobject]@{ Path = $relative; Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant() }
        } | Sort-Object Path
    $canonical = ($files | ForEach-Object { "$($_.Path):$($_.Hash)" }) -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = [System.BitConverter]::ToString($sha256.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
    }
    $hudVersion = (Get-Content (Join-Path $frontendRoot "package.json") -Raw | ConvertFrom-Json).version
    $metadata = [ordered]@{
        version = $hudVersion
        algorithm = "sha256"
        hash = $hash
        files = [ordered]@{}
    }
    foreach ($file in $files) { $metadata.files[$file.Path] = $file.Hash }
    $json = $metadata | ConvertTo-Json -Depth 5
    $localMetadata = Join-Path $releaseRoot "manifest.json"
    $serverHudRoot = Join-Path $dinoPublicRoot "hud"
    $serverReleaseRoot = Join-Path $serverHudRoot "release"
    if (Test-Path $serverReleaseRoot) { Remove-Item -Path $serverReleaseRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $serverReleaseRoot | Out-Null
    Copy-Item -Path (Join-Path $releaseRoot "*") -Destination $serverReleaseRoot -Recurse -Force
    $serverMetadata = Join-Path $serverHudRoot "manifest.json"
    [System.IO.File]::WriteAllText($localMetadata, $json + "`n", [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::WriteAllText($serverMetadata, $json + "`n", [System.Text.UTF8Encoding]::new($false))
    $serverDownloadsRoot = Join-Path $serverHudRoot "downloads"
    $downloadArchive = Join-Path $serverDownloadsRoot "TPNIsleControlHUD.zip"
    New-Item -ItemType Directory -Force -Path $serverDownloadsRoot | Out-Null
    if (Test-Path $downloadArchive) { Remove-Item -Path $downloadArchive -Force }
    Compress-Archive -Path (Join-Path $releaseRoot "*") -DestinationPath $downloadArchive -CompressionLevel Optimal
    Write-Host "Published HUD release $($metadata.version) with manifest hash $hash"
}

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

Write-Host "Configure compiled TPN Isle Control HUD settings. Press Enter to keep each current value."
Update-NativeConfig

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
if (Test-Path $releaseRoot) { Remove-Item -Path $releaseRoot -Recurse -Force }
& $cmake --install $buildRoot --config Release --prefix $releaseRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating release manifest and publishing files to tpn-dino..."
Publish-HudRelease

Write-Host "Build complete: $releaseRoot"
