[CmdletBinding()]
param(
    [switch]$Dev,
    [switch]$Start,
    [switch]$Build,
    [switch]$Test
)

$ErrorActionPreference = "Stop"

function Write-Badge {
    param(
        [string]$Type,
        [string]$Message
    )
    switch ($Type) {
        "INFO"    { Write-Host "ℹ [INFO] " -ForegroundColor Cyan -NoNewline; Write-Host $Message }
        "SUCCESS" { Write-Host "✔ [SUCCESS] " -ForegroundColor Green -NoNewline; Write-Host $Message }
        "WARN"    { Write-Host "⚠ [WARNING] " -ForegroundColor Yellow -NoNewline; Write-Host $Message }
        "ERROR"   { Write-Host "✖ [ERROR] " -ForegroundColor Red -NoNewline; Write-Host $Message }
    }
}

Write-Host ""
Write-Host "SoTube Windows Installation & Setup" -ForegroundColor Magenta
Write-Host ""

$hasNode = $false
$hasBun = $false

try {
    $nodeVer = (node -v 2>$null)
    if ($nodeVer) {
        $hasNode = $true
        Write-Badge "SUCCESS" "Node.js detected: $nodeVer"
    }
} catch { }

if (-not $hasNode) {
    $electronExe = Join-Path $PSScriptRoot "node_modules\electron\dist\electron.exe"
    if (Test-Path $electronExe) {
        $env:ELECTRON_RUN_AS_NODE = "1"
        $hasNode = $true
        Write-Badge "SUCCESS" "Node.js detected via bundled Electron runtime"
    }
}

try {
    $bunVer = (bun --version 2>$null)
    if ($bunVer) {
        $hasBun = $true
        Write-Badge "SUCCESS" "Bun detected: v$bunVer"
    }
} catch { }

if (-not $hasNode -and -not $hasBun) {
    Write-Badge "ERROR" "Neither Node.js nor Bun was found in PATH."
    Write-Host ""
    Write-Host "Please install one of the following runtimes:"
    Write-Host "  Node.js: https://nodejs.org/"
    Write-Host '  Bun:     powershell -c "irm bun.sh/install.ps1 | iex"'
    exit 1
}

Write-Badge "INFO" "Installing project dependencies..."
$hasNpm = [bool](Get-Command npm -ErrorAction SilentlyContinue)
if ($hasBun) {
    Write-Badge "INFO" "Executing: bun install"
    bun install
    if ($LASTEXITCODE -ne 0 -and $hasNpm) {
        Write-Badge "WARN" "Bun install encountered an issue, falling back to npm install..."
        npm install
    }
} elseif ($hasNpm) {
    Write-Badge "INFO" "Executing: npm install"
    npm install
} elseif (Test-Path (Join-Path $PSScriptRoot "node_modules")) {
    Write-Badge "SUCCESS" "Existing node_modules detected."
} else {
    Write-Badge "ERROR" "npm / bun CLI not found in PATH to install dependencies."
    exit 1
}

if ($LASTEXITCODE -eq 0 -or (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Badge "SUCCESS" "Dependencies verified."
} else {
    Write-Badge "ERROR" "Failed to install dependencies."
    exit $LASTEXITCODE
}

Write-Badge "INFO" "Verifying application assets..."
$assets = @(
    "assets/icon.ico",
    "assets/icon.png",
    "assets/sidebar.bmp",
    "assets/icon.bmp",
    "LICENSE.txt"
)

$assetsOk = $true
foreach ($asset in $assets) {
    if (Test-Path $asset) {
        Write-Badge "SUCCESS" "Found $asset"
    } else {
        Write-Badge "ERROR" "Missing required asset: $asset"
        $assetsOk = $false
    }
}

if (-not $assetsOk) {
    Write-Badge "ERROR" "Asset validation failed."
    exit 1
}

if ($Test) {
    Write-Badge "INFO" "Running automated test suite..."
    npm run test
    exit $LASTEXITCODE
}

if ($Build) {
    Write-Badge "INFO" "Building Inno Setup Windows installer..."
    npm run build:inno
    exit $LASTEXITCODE
}

if ($Dev) {
    Write-Badge "INFO" "Launching development mode with watch..."
    npm run dev
    exit $LASTEXITCODE
}

if ($Start) {
    Write-Badge "INFO" "Starting SoTube desktop application..."
    npm start
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "✔ [SUCCESS] SoTube setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands to get started:" -ForegroundColor White
Write-Host "  npm start          Start SoTube desktop app"
Write-Host "  npm run dev        Start live reload file watcher"
Write-Host "  npm run watch      Start live reload file watcher"
Write-Host "  npm run test       Run automated test suite"
Write-Host "  npm run dev:inno   Compile Windows Inno Setup installer"
Write-Host ""
