$ErrorActionPreference = "Stop"

$projectRoot = "s:\02_PROJECTS_CODE\code projects mine\uopeople-brightspace-course-export"
$distDir = Join-Path $projectRoot "dist"
$tempDir = Join-Path $distDir "package_temp"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$coreFiles = @(
    "manifest.json",
    "background.js",
    "content.js",
    "d2l_api.js",
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

foreach ($file in $coreFiles) {
    $srcPath = Join-Path $projectRoot $file
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $tempDir
    } else {
        Write-Warning "File not found: $file"
    }
}

$iconsSrc = Join-Path $projectRoot "icons"
$iconsDst = Join-Path $tempDir "icons"
Copy-Item -Path $iconsSrc -Destination $iconsDst -Recurse

$manifestPath = Join-Path $projectRoot "manifest.json"
$manifestJson = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifestJson.version

# Create POSIX-compliant zip archive with forward slashes (required by Firefox addons-linter)
$zipOutput = Join-Path $distDir "uopeople-course-exporter-v$version.zip"
if (Test-Path $zipOutput) {
    Remove-Item -Force $zipOutput
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipArchive = [System.IO.Compression.ZipFile]::Open($zipOutput, [System.IO.Compression.ZipArchiveMode]::Create)
$allFiles = Get-ChildItem -Path $tempDir -Recurse -File

foreach ($f in $allFiles) {
    # Calculate relative path and force forward slashes
    $relPath = $f.FullName.Substring($tempDir.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $f.FullName, $relPath) | Out-Null
}

$zipArchive.Dispose()
Remove-Item -Recurse -Force $tempDir

Write-Host "Production Package Created Successfully at:"
Write-Host $zipOutput
Get-Item $zipOutput | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
