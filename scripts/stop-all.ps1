# stop-all.ps1 — Stop all MediQ local servers (Ktor 8099, Hono BFF 3000, Angular 4200)
# Usage: powershell -File .\stop-all.ps1

$ErrorActionPreference = 'Continue'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '============================================'
Write-Host '  MediQ — Stop All Local Servers'
Write-Host '============================================'
Write-Host ''

$paths = @(
    (Join-Path $rootDir 'server\stop-server.ps1'),
    (Join-Path $rootDir 'mediqweb\mediqapp-api\stop-api.ps1'),
    (Join-Path $rootDir 'mediqweb\mediqweb-fe\stop-web.ps1')
)

foreach ($p in $paths) {
    if (-not (Test-Path $p)) {
        Write-Host ('  SKIP: script not found: ' + $p)
        continue
    }
    Write-Host ('  Stopping: ' + $p)
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $p)
    Start-Process powershell -ArgumentList $args -Wait -NoNewWindow | Out-Null
}

Write-Host ''
Write-Host 'All stop scripts executed. Verify ports are free.'
$pauseMsg = 'Press any key to close...'
Read-Host -Prompt $pauseMsg
