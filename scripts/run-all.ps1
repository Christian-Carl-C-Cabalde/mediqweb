# run-all.ps1 — Start all MediQ local servers (Ktor 8099, Hono BFF 3000, Angular 4200)
# Runs each server in its own PowerShell window so you can see logs for each.
#
# Usage: powershell -File .\run-all.ps1

$ErrorActionPreference = 'Continue'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '============================================'
Write-Host '  MediQ — Start All Local Servers'
Write-Host '============================================'
Write-Host ''

function Start-One {
    param([string]$name, [string]$dir, [string]$script)
    $scriptPath = Join-Path $dir $script
    if (-not (Test-Path $scriptPath)) {
        Write-Host ('  SKIP: ' + $name + ' — script not found: ' + $scriptPath)
        return
    }
    Write-Host ('  Starting ' + $name + ' in a new window...')
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath)
    Start-Process powershell -ArgumentList $args -WorkingDirectory $dir
}

Start-One -name 'Ktor Server (8099)' -dir (Join-Path $rootDir 'server') -script 'run-server.ps1'
Start-One -name 'Hono BFF (3000)' -dir (Join-Path $rootDir 'mediqweb\mediqapp-api') -script 'run-api.ps1'
Start-One -name 'Angular (4200)' -dir (Join-Path $rootDir 'mediqweb\mediqweb-fe') -script 'run-web.ps1'

Write-Host ''
Write-Host 'All servers launched. Each has its own window.'
Write-Host 'Use stop-all.ps1 to shut them all down.'
$pauseMsg = 'Press any key to close...'
Read-Host -Prompt $pauseMsg
