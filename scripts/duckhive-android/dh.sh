#!/bin/bash
# DuckHive Android CLI - Unified command interface
# Usage: dh [command] [options]

set -e

DUCKHIVE_DIR="/data/data/com.termux/files/opt/duckhive"

show_help() {
    cat << EOF
DuckHive Android CLI v1.0

Usage: dh [command] [options]

Commands:
  update              Update DuckHive to latest version
  backup              Backup DuckHive data and config
  restore             Restore from backup
  android screenshot  Take screenshot from connected Android device
  android tap <x> <y> Tap screen coordinates on Android device
  android swipe <x1> <y1> <x2> <y2>  Swipe on Android device
  android text <text>  Input text on Android device
  android shell <cmd> Run shell command on Android device
  onboard             Run initial onboarding/setup
  gateway            Start DuckHive gateway mode
  status             Show DuckHive status

Options:
  -h, --help         Show this help message
  -v, --version      Show version

Examples:
  dh update
  dh backup
  dh android screenshot
  dh android tap 500 500
  dh onboard

EOF
}

cmd_update() {
    echo "Updating DuckHive..."
    cd "$DUCKHIVE_DIR"
    git pull origin main
    npm run build
    echo "Update complete!"
}

cmd_backup() {
    echo "Backing up DuckHive..."
    BACKUP_DIR="/sdcard/duckhive_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$DUCKHIVE_DIR"/{config,skills,.env} "$BACKUP_DIR/" 2>/dev/null || true
    echo "Backup saved to: $BACKUP_DIR"
}

cmd_restore() {
    echo "Available backups:"
    ls -la /sdcard/duckhive_backup_* 2>/dev/null || echo "No backups found"
    read -p "Enter backup directory: " BACKUP_DIR
    if [ -d "$BACKUP_DIR" ]; then
        cp -r "$BACKUP_DIR"/* "$DUCKHIVE_DIR/"
        echo "Restore complete!"
    else
        echo "Backup directory not found"
    fi
}

cmd_android() {
    case "$1" in
        screenshot)
            adb exec-out screencap -p > "/sdcard/duckhive_screenshot_$(date +%s).png"
            echo "Screenshot saved to /sdcard/"
            ;;
        tap)
            adb shell input tap "$2" "$3"
            ;;
        swipe)
            adb shell input swipe "$2" "$3" "$4" "$5"
            ;;
        text)
            adb shell input text "$2"
            ;;
        shell)
            adb shell "$2"
            ;;
        *)
            echo "Unknown android command: $1"
            echo "Available: screenshot, tap, swipe, text, shell"
            ;;
    esac
}

cmd_onboard() {
    cd "$DUCKHIVE_DIR"
    ./bin/duckhive onboard
}

cmd_gateway() {
    cd "$DUCKHIVE_DIR"
    ./bin/duckhive gateway
}

cmd_status() {
    echo "DuckHive Status:"
    echo "Version: $($DUCKHIVE_DIR/bin/duckhive --version 2>/dev/null || echo 'unknown')"
    echo "Install: $DUCKHIVE_DIR"
    echo "Android devices:"
    adb devices 2>/dev/null || echo "ADB not available"
}

case "$1" in
    update)
        cmd_update
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore
        ;;
    android)
        shift
        cmd_android "$@"
        ;;
    onboard)
        cmd_onboard
        ;;
    gateway)
        cmd_gateway
        ;;
    status)
        cmd_status
        ;;
    -h|--help)
        show_help
        ;;
    -v|--version)
        echo "DuckHive Android CLI v1.0"
        ;;
    *)
        show_help
        ;;
esac
