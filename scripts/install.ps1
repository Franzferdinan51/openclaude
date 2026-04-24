param(
  [string]$Prefix = "$env:LOCALAPPDATA\DuckHive"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[DuckHive install] $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Error "[DuckHive install] $Message"
  exit 1
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BinDir = Join-Path $Prefix "bin"
$Launcher = Join-Path $BinDir "duckhive.cmd"

Write-Step "Installing from $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js 20+ is required. Install Node.js from https://nodejs.org and rerun this script."
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]") | Select-Object -First 1)
if ($nodeMajor -lt 20) {
  Fail "Node.js 20+ is required. Found $(node --version)."
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Step "Bun was not found. Installing Bun with the official installer."
  powershell -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"
  $env:PATH = "$env:USERPROFILE\.bun\bin;$env:LOCALAPPDATA\bun;$env:PATH"
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Fail "Bun install did not put bun on PATH. Open a new terminal or add Bun to PATH."
}

if (Get-Command git -ErrorAction SilentlyContinue) {
  Write-Step "Git detected: $(git --version)"
} else {
  Write-Step "Git not found. DuckHive can run, but repo workflows will be limited."
}

Write-Step "Installing dependencies"
Push-Location $Root
bun install

Write-Step "Building DuckHive"
bun run build

if (Get-Command go -ErrorAction SilentlyContinue) {
  Write-Step "Building enhanced TUI"
  Push-Location (Join-Path $Root "tui")
  go build -o duckhive-tui.exe ./cmd/duckhive-tui
  Pop-Location
} else {
  Write-Step "Go not found; keeping the existing tui\duckhive-tui binary if present."
}
Pop-Location

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$LauncherContent = @"
@echo off
node "$Root\bin\duckhive" %*
"@
Set-Content -Path $Launcher -Value $LauncherContent -Encoding ASCII

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (($userPath -split ';') -notcontains $BinDir) {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$BinDir", "User")
  Write-Step "Added $BinDir to your user PATH. Open a new terminal before running duckhive."
}

Write-Step "Installed launcher: $Launcher"
Write-Step "Run: duckhive --version"
