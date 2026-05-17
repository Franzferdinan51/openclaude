# DuckHive PowerShell installer
# Run from the repository root with:
#   powershell -ExecutionPolicy Bypass -File install.ps1

param(
  [string]$Prefix = "$env:LOCALAPPDATA\DuckHive"
)

$ErrorActionPreference = "Stop"

$Installer = Join-Path $PSScriptRoot "scripts\install.ps1"
if (-not (Test-Path $Installer)) {
  Write-Error "[DuckHive install] Missing installer: $Installer"
  exit 1
}

& $Installer -Prefix $Prefix
