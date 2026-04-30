# DuckHive PowerShell Installer
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

Write-Host "[DuckHive] Starting installation..." -ForegroundColor Cyan

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Installing..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile "$env:TEMP\node-installer.msi"
    Start-Process msiexec -ArgumentList "/i $env:TEMP\node-installer.msi /quiet" -Wait
    Remove-Item "$env:TEMP\node-installer.msi"
}

# Check Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Bun..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -OutFile "$env:TEMP\bun-install.ps1"
    & "$env:TEMP\bun-install.ps1"
    Remove-Item "$env:TEMP\bun-install.ps1"
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
bun install

# Build
Write-Host "Building DuckHive..." -ForegroundColor Yellow
bun run build

# Set PATH
$duckhivePath = $PWD.Path
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$duckhivePath*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$duckhivePath", "User")
    Write-Host "Added to PATH. Restart your terminal or run: $env:PATH = $currentPath;$duckhivePath" -ForegroundColor Green
}

Write-Host "[DuckHive] Installation complete!" -ForegroundColor Green
Write-Host "Run: ./bin/duckhive" -ForegroundColor Cyan
