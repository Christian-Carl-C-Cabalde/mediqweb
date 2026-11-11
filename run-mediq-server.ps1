# run-mediq-server.ps1
# Starts the MediQ Ktor server on http://127.0.0.1:8099.
#
# The server requires JWT_SECRET plus DB env vars. JWT_SECRET is set inline here;
# the DB vars (MEDIQ_JDBC_URL, MEDIQ_DB_USER, MEDIQ_DB_PASSWORD, DB_DRIVER) are
# loaded automatically from server/.env by Database.loadDotEnv() inside the Ktor app.
#
# Usage: .\run-mediq-server.ps1
# Press Ctrl-C to stop the server.

$ErrorActionPreference = 'Stop'
$serverDir = Join-Path $PSScriptRoot 'server'

if (-not (Test-Path -LiteralPath $serverDir)) {
    Write-Error "Server directory not found: $serverDir"
    exit 1
}

Push-Location -LiteralPath $serverDir
try {
    if (-not $env:JWT_SECRET) {
        $env:JWT_SECRET = 'dev-secret'
        Write-Host 'JWT_SECRET set to dev-secret'
    } else {
        Write-Host 'JWT_SECRET already set'
    }

    ./gradlew.bat run
}
finally {
    Pop-Location
}
