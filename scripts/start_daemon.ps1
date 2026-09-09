<#
.SYNOPSIS
    Starts the UoPeople Course Exporter Companion Daemon on port 4048
.DESCRIPTION
    Runs the standalone Python companion daemon handling native desktop folder selection
    and automated coursework package unzipping.
#>

[CmdletBinding()]
param(
    [int]$Port = 4048
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DaemonScript = Join-Path $ScriptDir "course_exporter_daemon.py"

Write-Host "[UoPeople Exporter] Starting companion daemon on port $Port..." -ForegroundColor Cyan
& python $DaemonScript --port $Port
