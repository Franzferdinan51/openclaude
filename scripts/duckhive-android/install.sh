#!/bin/bash
# DuckHive Android Installer
# Enables DuckHive on Android via Termux
# Based on openclaw-android approach by AidanPark

set -e

DUCKHIVE_VERSION="${DUCKHIVE_VERSION:-latest}"
TERMUX_PREFIX="${TERMUX_PREFIX:-/data/data/com.termux/files/usr}"
DUCKHIVE_INSTALL_DIR="$TERMUX_PREFIX/opt/duckhive"
DUCKHIVE_BIN_DIR="$TERMUX_PREFIX/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed."
        exit 1
    fi

    if ! command -v tar &> /dev/null; then
        log_error "tar is required but not installed."
        exit 1
    fi

    # Check if we're in Termux
    if [ ! -d "/data/data/com.termux" ]; then
        log_warn "This script should be run inside Termux on Android."
        log_info "If you're on a desktop system, use the standard install.sh instead."
    fi

    log_success "Dependencies OK"
}

detect_android_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        aarch64|arm64)
            echo "arm64"
            ;;
        armv7l|armhf)
            echo "arm"
            ;;
        x86_64)
            echo "x86_64"
            ;;
        i386|i686)
            echo "x86"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
}

download_duckhive() {
    log_info "Downloading DuckHive v${DUCKHIVE_VERSION} for Android (${ARCH})..."

    mkdir -p "$DUCKHIVE_INSTALL_DIR"

    # Download the Linux binary (we'll wrap it with ld.so)
    DOWNLOAD_URL="https://github.com/Franzferdinan51/DuckHive/releases/${DUCKHIVE_VERSION}/duckhive-linux-${ARCH}.tar.gz"

    if curl -sL "$DOWNLOAD_URL" -o /tmp/duckhive.tar.gz; then
        tar -xzf /tmp/duckhive.tar.gz -C "$DUCKHIVE_INSTALL_DIR"
        rm /tmp/duckhive.tar.gz
        chmod +x "$DUCKHIVE_INSTALL_DIR/bin/duckhive"
        log_success "Downloaded and extracted DuckHive"
    else
        log_warn "Pre-built binary not available, building from source..."
        build_from_source
    fi
}

build_from_source() {
    log_info "Building DuckHive from source..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        pkg install nodejs
    fi

    cd "$DUCKHIVE_INSTALL_DIR"

    if [ "$DUCKHIVE_VERSION" = "latest" ]; then
        git clone https://github.com/Franzferdinan51/DuckHive.git .
    else
        git clone --branch "$DUCKHIVE_VERSION" https://github.com/Franzferdinan51/DuckHive.git .
    fi

    npm install
    npm run build
    log_success "Built DuckHive from source"
}

setup_glibc_runner() {
    log_info "Setting up glibc runner for Android..."

    # Install glibc via Termux packages
    pkg update
    pkg install proot proot-distro glibc-runner

    # Create the ld.so wrapper script
    cat > "$DUCKHIVE_INSTALL_DIR/duckhive-wrapper.sh" << 'WRAPPER'
#!/bin/bash
# DuckHive wrapper script for Android
# Uses glibc-runner's ld.so to run Linux binaries

export LD_LIBRARY_PATH="/data/data/com.termux/files/usr/glibc/lib:$LD_LIBRARY_PATH"
export G_LIBC_PREINIT=1

# Path conversions for Termux
convert_path() {
    echo "$1" | sed "s|/root|/data/data/com.termux/files/home|g" | sed "s|/home|/data/data/com.termux/files/home|g"
}

# Convert common paths
for arg in "$@"; do
    case "$arg" in
        /*)
            converted=$(convert_path "$arg")
            set -- "$@" "$converted"
            ;;
    esac
done

exec /data/data/com.termux/files/usr/glibc/bin/ld.so "$DUCKHIVE_INSTALL_DIR/bin/duckhive" "$@"
WRAPPER

    chmod +x "$DUCKHIVE_INSTALL_DIR/duckhive-wrapper.sh"
    log_success "Glibc runner setup complete"
}

setup_path() {
    log_info "Setting up PATH..."

    # Create convenience symlinks
    ln -sf "$DUCKHIVE_INSTALL_DIR/duckhive-wrapper.sh" "$DUCKHIVE_BIN_DIR/duckhive"
    ln -sf "$DUCKHIVE_INSTALL_DIR/duckhive-wrapper.sh" "$DUCKHIVE_BIN_DIR/dh"  # Short alias

    log_success "PATH setup complete"
}

setup_android_tools() {
    log_info "Setting up Android-specific tools..."

    # Create ADB wrapper if adb is available
    if command -v adb &> /dev/null; then
        mkdir -p "$DUCKHIVE_INSTALL_DIR/android"
        cat > "$DUCKHIVE_INSTALL_DIR/android/adb-wrapper.sh" << 'ADBWRAPPER'
#!/bin/bash
# ADB wrapper that auto-connects to devices
export ANDROID_SERIAL="${ANDROID_SERIAL:-$(adb devices | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:5555' | head -1 | cut -f1)}"
exec adb "$@"
ADBWRAPPER
        chmod +x "$DUCKHIVE_INSTALL_DIR/android/adb-wrapper.sh"
        log_success "ADB wrapper created"
    fi

    # Create scrcpy wrapper for screen mirroring
    if command -v scrcpy &> /dev/null; then
        cat > "$DUCKHIVE_INSTALL_DIR/android/scrcpy-wrapper.sh" << 'SCRCPYWRAPPER'
#!/bin/bash
# Scrcpy wrapper for Android screen mirroring
exec scrcpy --window-title="DuckHive Android" "$@"
SCRCPYWRAPPER
        chmod +x "$DUCKHIVE_INSTALL_DIR/android/scrcpy-wrapper.sh"
        log_success "Scrcpy wrapper created"
    fi
}

create_uninstall_script() {
    cat > "$DUCKHIVE_INSTALL_DIR/uninstall.sh" << 'UNINSTALL'
#!/bin/bash
# Uninstall DuckHive from Android/Termux
read -p "Remove DuckHive and all data? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf /data/data/com.termux/files/opt/duckhive
    rm -f /data/data/com.termux/files/usr/bin/duckhive
    rm -f /data/data/com.termux/files/usr/bin/dh
    echo "DuckHive uninstalled."
fi
UNINSTALL
    chmod +x "$DUCKHIVE_INSTALL_DIR/uninstall.sh"
}

main() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║    DuckHive Android Installer v1.0     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""

    check_dependencies
    ARCH=$(detect_android_arch)
    download_duckhive
    setup_glibc_runner
    setup_path
    setup_android_tools
    create_uninstall_script

    echo ""
    log_success "DuckHive installed successfully!"
    echo ""
    echo "Usage:"
    echo "  duckhive --help    # Show help"
    echo "  duckhive onboard   # Initial setup"
    echo "  duckhive gateway   # Start gateway mode"
    echo ""
    echo "Android tools:"
    echo "  duckhive android screenshot  # Take device screenshot"
    echo "  duckhive android tap <x> <y>  # Tap screen coordinates"
    echo ""
    echo -e "${YELLOW}Note: Run 'duckhive onboard' first to configure.${NC}"
    echo ""
}

main "$@"
