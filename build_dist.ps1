$ErrorActionPreference = "Stop"

$projectRoot = "s:\02_PROJECTS_CODE\code projects mine\uopeople-brightspace-course-export"
$distDir = Join-Path $projectRoot "dist"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$coreFiles = @(
    "background.js",
    "content.js",
    "d2l_api.js",
    "vendor_assets.js",
    "html_builder.js",
    "markdown_builder.js",
    "zip_builder.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "PRIVACY.md",
    "LICENSE",
    "README.md"
)

$baseManifestPath = Join-Path $projectRoot "manifest.json"
$baseManifest = Get-Content $baseManifestPath -Raw | ConvertFrom-Json
$version = $baseManifest.version

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Create-BrowserZip {
    param (
        [string]$TargetBrowser, # "firefox" or "edge-chrome"
        [string]$ZipName
    )

    $tempDir = Join-Path $distDir "package_temp_$TargetBrowser"
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir
    }
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    # Copy core assets
    foreach ($file in $coreFiles) {
        $srcPath = Join-Path $projectRoot $file
        if (Test-Path $srcPath) {
            Copy-Item -Path $srcPath -Destination $tempDir
        }
    }

    # Copy icons
    $iconsSrc = Join-Path $projectRoot "icons"
    $iconsDst = Join-Path $tempDir "icons"
    Copy-Item -Path $iconsSrc -Destination $iconsDst -Recurse

    # Build browser-specific manifest
    $targetManifest = Get-Content $baseManifestPath -Raw | ConvertFrom-Json

    if ($TargetBrowser -eq "firefox") {
        # Firefox MV3 requires background.scripts and gecko settings
        $targetManifest.background = [PSCustomObject]@{
            scripts = @("background.js")
        }
    } elseif ($TargetBrowser -eq "edge-chrome") {
        # Chromium (Edge & Chrome) strictly requires service_worker and no gecko settings
        $targetManifest.background = [PSCustomObject]@{
            service_worker = "background.js"
        }
        if ($targetManifest.PSObject.Properties["browser_specific_settings"]) {
            $targetManifest.PSObject.Properties.Remove("browser_specific_settings")
        }
    }

    $targetManifestPath = Join-Path $tempDir "manifest.json"
    $targetManifest | ConvertTo-Json -Depth 10 | Set-Content -Path $targetManifestPath -Encoding UTF8

    # Create POSIX-compliant zip archive with forward slashes
    $zipOutput = Join-Path $distDir $ZipName
    if (Test-Path $zipOutput) {
        Remove-Item -Force $zipOutput
    }

    $zipArchive = [System.IO.Compression.ZipFile]::Open($zipOutput, [System.IO.Compression.ZipArchiveMode]::Create)
    $allFiles = Get-ChildItem -Path $tempDir -Recurse -File

    foreach ($f in $allFiles) {
        $relPath = $f.FullName.Substring($tempDir.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $f.FullName, $relPath) | Out-Null
    }

    $zipArchive.Dispose()
    Remove-Item -Recurse -Force $tempDir

    Write-Host "Created [$TargetBrowser]: $ZipName"
}

# Build both Firefox and Edge/Chrome packages
Create-BrowserZip -TargetBrowser "firefox" -ZipName "uopeople-course-exporter-v$version-firefox.zip"
Create-BrowserZip -TargetBrowser "edge-chrome" -ZipName "uopeople-course-exporter-v$version-edge-chrome.zip"

Write-Host "`nAll Production Packages Created in $distDir :"
Get-ChildItem -Path $distDir -Filter "*.zip" | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize

