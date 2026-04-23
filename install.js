#!/usr/bin/env node
/**
 * DuckHive Cross-Platform Installer
 * Supports: Windows (PowerShell), Linux (bash), macOS (zsh/bash)
 */

import { execSync, spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

const REQUIRED_MODULES = ['bun', 'node'];
const OPTIONAL_MODULES = ['git'];

const errors = [];
const warnings = [];

function log(info, msg) {
  console[info === 'error' ? 'error' : info === 'warn' ? 'warn' : 'log'](`[DuckHive Installer] ${msg}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    }).trim();
  } catch (e) {
    return e.stdout || e.message;
  }
}

function checkCommand(cmd) {
  try {
    exec(`${cmd} --version`);
    return true;
  } catch {
    return false;
  }
}

function detectShell() {
  if (isWindows) {
    const psVersion = exec('powershell -Command "$PSVersionTable.PSVersion.Major"');
    if (psVersion) return { name: 'powershell', version: parseInt(psVersion) };
    return { name: 'cmd', version: null };
  }
  const shell = process.env.SHELL || 'bash';
  const version = exec(`${shell} --version 2>/dev/null | head -1`) || 'unknown';
  return { name: shell.includes('zsh') ? 'zsh' : 'bash', version };
}

function checkNode() {
  log('info', 'Checking Node.js...');
  if (!checkCommand('node')) {
    errors.push('Node.js is not installed. Please install Node.js 18+ from https://nodejs.org');
    return false;
  }
  const version = exec('node --version').replace('v', '');
  const major = parseInt(version.split('.')[0]);
  if (major < 18) {
    errors.push(`Node.js ${version} is too old. Please upgrade to Node.js 18+`);
    return false;
  }
  log('info', `Node.js ${version} found`);
  return true;
}

function checkBun() {
  log('info', 'Checking Bun...');
  if (!checkCommand('bun')) {
    log('warn', 'Bun not found. Installing Bun...');
    let installCmd;
    if (isWindows) {
      installCmd = 'powershell -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"';
    } else if (isMac) {
      installCmd = 'curl -fsSL https://bun.sh/install | bash';
    } else {
      installCmd = 'curl -fsSL https://bun.sh/install | bash';
    }
    try {
      exec(installCmd, { stdio: 'inherit' });
      // Refresh PATH
      const bunPath = isWindows
        ? join(process.env.LOCALAPPDATA || '', 'bun', 'bun.exe')
        : join(process.env.HOME || '', '.bun', 'bin', 'bun');
      if (!existsSync(bunPath)) {
        errors.push('Bun installation failed');
        return false;
      }
      log('info', 'Bun installed successfully');
    } catch (e) {
      errors.push(`Bun installation failed: ${e.message}`);
      return false;
    }
  } else {
    log('info', `Bun ${exec('bun --version')} found`);
  }
  return true;
}

function checkGit() {
  log('info', 'Checking Git...');
  if (!checkCommand('git')) {
    if (isWindows) {
      log('warn', 'Git not found. Downloading Git for Windows...');
      try {
        exec('powershell -Command "winget install Git.Git -s winget --accept-source-agreements --accept-package-agreements"', { stdio: 'inherit' });
      } catch {
        warnings.push('Git not installed. Some features may not work.');
      }
    } else if (isMac) {
      if (!checkCommand('git')) {
        warnings.push('Git not found. Install with: xcode-select --install');
      }
    } else {
      warnings.push('Git not found. Install with: sudo apt install git (Debian/Ubuntu) or sudo yum install git (RHEL/Fedora)');
    }
  } else {
    log('info', `Git ${exec('git --version').replace('git version ', '')} found`);
  }
  return true;
}

function installDependencies() {
  log('info', 'Installing npm dependencies...');
  try {
    if (existsSync(join(__dirname, 'node_modules'))) {
      log('info', 'node_modules already exists, running npm install anyway...');
    }
    exec('npm install', { stdio: 'inherit' });
    log('info', 'Dependencies installed');
    return true;
  } catch (e) {
    errors.push(`npm install failed: ${e.message}`);
    return false;
  }
}

function buildProject() {
  log('info', 'Building DuckHive...');
  try {
    exec('npm run build', { stdio: 'inherit' });
    log('info', 'Build complete');
    return true;
  } catch (e) {
    errors.push(`Build failed: ${e.message}`);
    return false;
  }
}

function setupPermissions() {
  log('info', 'Setting up permissions...');
  if (!isWindows) {
    try {
      exec('chmod +x bin/duckhive');
      exec('chmod +x scripts/*.sh 2>/dev/null || true');
      log('info', 'Permissions set');
    } catch {
      warnings.push('Could not set executable permissions');
    }
  }
  return true;
}

function addToPathWindows(installDir) {
  log('info', 'Adding DuckHive to PATH (Windows)...');
  try {
    const duckhivePath = installDir;
    const psCommand = `
      $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
      if ($currentPath -notlike "*duckhive*") {
        [Environment]::SetEnvironmentVariable('Path', "$currentPath;${duckhivePath}", 'User')
        Write-Host 'Added to PATH. Please restart your terminal.'
      } else {
        Write-Host 'DuckHive already in PATH'
      }
    `;
    exec(`powershell -Command "${psCommand.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`);
    return true;
  } catch (e) {
    warnings.push(`Could not add to PATH: ${e.message}`);
    return false;
  }
}

function addToPathUnix(installDir) {
  log('info', 'Adding DuckHive to PATH...');
  const shell = detectShell();
  const profileFile = shell.name === 'zsh'
    ? join(process.env.HOME || '', '.zshrc')
    : join(process.env.HOME || '', '.bashrc');

  const exportLine = `export PATH="${installDir}:$PATH"`;

  try {
    if (existsSync(profileFile)) {
      const content = readFileSync(profileFile, 'utf8');
      if (!content.includes('duckhive')) {
        writeFileSync(profileFile, `\n# DuckHive\n${exportLine}\n`, { flag: 'a' });
        log('info', `Added to ${profileFile}`);
      } else {
        log('info', 'DuckHive already in PATH configuration');
      }
    }
    return true;
  } catch (e) {
    warnings.push(`Could not update ${profileFile}: ${e.message}`);
    return false;
  }
}

function createWindowsLauncher() {
  log('info', 'Creating Windows launcher...');
  const installDir = __dirname;
  const launcherPath = join(installDir, 'duckhive.cmd');

  const launcherContent = `@echo off
REM DuckHive Windows Launcher
setlocal

REM Find bun installation
set BUN_PATH=
if exist "%LOCALAPPDATA%\\bun\\bun.exe" set BUN_PATH=%LOCALAPPDATA%\\bun\\bun.exe
if exist "%USERPROFILE%\\.bun\\bin\\bun.exe" set BUN_PATH=%USERPROFILE%\\.bun\\bin\\bun.exe

REM Use bun if available, otherwise node
if defined BUN_PATH (
  "%BUN_PATH%" run "%~dp0bin\\duckhive" %*
) else (
  node "%~dp0dist\\cli.mjs" %*
)
`;

  try {
    writeFileSync(launcherPath, launcherContent);
    log('info', 'Windows launcher created');
    return true;
  } catch (e) {
    warnings.push(`Could not create launcher: ${e.message}`);
    return false;
  }
}

function createPowershellInstaller() {
  log('info', 'Creating PowerShell install script...');
  const scriptContent = `# DuckHive PowerShell Installer
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

Write-Host "[DuckHive] Starting installation..." -ForegroundColor Cyan

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Installing..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile "$env:TEMP\\node-installer.msi"
    Start-Process msiexec -ArgumentList "/i $env:TEMP\\node-installer.msi /quiet" -Wait
    Remove-Item "$env:TEMP\\node-installer.msi"
}

# Check Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Bun..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -OutFile "$env:TEMP\\bun-install.ps1"
    & "$env:TEMP\\bun-install.ps1"
    Remove-Item "$env:TEMP\\bun-install.ps1"
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
`;

  try {
    writeFileSync(join(__dirname, 'install.ps1'), scriptContent);
    log('info', 'PowerShell install script created');
    return true;
  } catch (e) {
    warnings.push(`Could not create PowerShell script: ${e.message}`);
    return false;
  }
}

function createBashInstaller() {
  log('info', 'Creating Bash install script...');
  const scriptContent = `#!/bin/bash
# DuckHive Bash/Linux/macOS Installer

set -e

echo "[DuckHive] Starting installation..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    echo "[DuckHive] Unsupported OS: $OSTYPE"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[DuckHive] Node.js not found. Installing..."
    if [[ "$OS" == "macos" ]]; then
        brew install node
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
fi

# Check Bun
if ! command -v bun &> /dev/null; then
    echo "[DuckHive] Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Install dependencies
echo "[DuckHive] Installing dependencies..."
bun install

# Build
echo "[DuckHive] Building..."
bun run build

# Add to PATH
DUCKHIVE_DIR=$(cd "$(dirname "$0")" && pwd)
SHELL_RC="$HOME/.$(basename "$SHELL")rc"

if ! grep -q "duckhive" "$SHELL_RC" 2>/dev/null; then
    echo 'export PATH="'"$DUCKHIVE_DIR"'/bin:$PATH"' >> "$SHELL_RC"
    echo "[DuckHive] Added to $SHELL_RC"
    echo "[DuckHive] Restart your shell or run: source $SHELL_RC"
fi

echo "[DuckHive] Installation complete!"
echo "Run: ./bin/duckhive"
`;

  try {
    writeFileSync(join(__dirname, 'install.sh'), scriptContent);
    if (!isWindows) {
      exec('chmod +x install.sh');
    }
    log('info', 'Bash install script created');
    return true;
  } catch (e) {
    warnings.push(`Could not create Bash script: ${e.message}`);
    return false;
  }
}

function printReport() {
  console.log('\n' + '='.repeat(50));
  console.log('[DuckHive] Installation Report');
  console.log('='.repeat(50));

  if (errors.length > 0) {
    console.log('\n[ERRORS]');
    errors.forEach(e => console.error(`  - ${e}`));
  }

  if (warnings.length > 0) {
    console.log('\n[WARNINGS]');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (errors.length === 0) {
    console.log('\n[SUCCESS] DuckHive is ready!');
    console.log('\nTo get started:');
    console.log('  ./bin/duckhive');
    if (!isWindows) {
      console.log('  or add to PATH: export PATH="$(pwd)/bin:$PATH"');
    }
  } else {
    console.log('\n[FAILED] Please fix the errors above.');
    console.log('For help, see: https://github.com/Franzferdinan51/DuckHive/issues');
  }
  console.log('='.repeat(50) + '\n');
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           DuckHive Installer v0.8.0                    ║
║   CLI Agent with Multi-Model Support                   ║
╚═══════════════════════════════════════════════════════╝
`);

  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Shell: ${detectShell().name}`);
  console.log('');

  // Run checks and installations
  const checks = [
    ['Node.js', checkNode],
    ['Bun', checkBun],
    ['Git', checkGit],
  ];

  for (const [name, fn] of checks) {
    console.log(`--- ${name} ---`);
    fn();
    console.log('');
  }

  // Install dependencies
  console.log('--- Dependencies ---');
  installDependencies();
  console.log('');

  // Build
  console.log('--- Build ---');
  buildProject();
  console.log('');

  // Setup
  setupPermissions();

  // Create platform-specific installers
  createPowershellInstaller();
  createBashInstaller();
  if (isWindows) {
    createWindowsLauncher();
    addToPathWindows(__dirname);
  } else {
    addToPathUnix(join(__dirname, 'bin'));
  }

  // Report
  printReport();
}

main().catch(console.error);
