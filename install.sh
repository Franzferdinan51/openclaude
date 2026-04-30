#!/bin/bash
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
