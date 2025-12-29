# Start UNICON client+server in HTTPS/WSS dev mode
# Usage: right-click -> Run with PowerShell (or run in pwsh)

$env:VITE_HTTPS = '1'
$env:VITE_WS_URL = 'wss://localhost:8080'
# Point these to your dev key/cert (see server/certs/README.md)
if (-not $env:HTTPS_KEY_FILE) { $env:HTTPS_KEY_FILE = 'server/certs/dev.key' }
if (-not $env:HTTPS_CERT_FILE) { $env:HTTPS_CERT_FILE = 'server/certs/dev.crt' }

npm run dev:all
