<#
.SYNOPSIS
    UoPeople Course Package Unpacker & Coursework Initializer
.DESCRIPTION
    Runs the Python processor to unzip downloaded course materials into the active courses folder,
    clean up ZIP files, and generate coursework folders for Units 1 through 8.
#>

[CmdletBinding()]
param(
    [string]$ActiveFolder = "",
    [switch]$Daemon
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PyScript = Join-Path $ScriptDir "process_active_courses.py"

$ArgsList = @()
if ($ActiveFolder) {
    $ArgsList += "--folder"
    $ArgsList += $ActiveFolder
}
if ($Daemon) {
    $ArgsList += "--daemon"
}

Write-Host "[UoPeople Exporter] Initiating active courses coursework organizer..." -ForegroundColor Cyan
& python $PyScript @ArgsList
