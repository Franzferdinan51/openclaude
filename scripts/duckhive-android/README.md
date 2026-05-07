# DuckHive Android Port

Based on the [openclaw-android](https://github.com/AidanPark/openclaw-android) approach by AidanPark.

## Requirements

- Android device with [Termux](https://f-droid.org/en/packages/com.termux/) installed (F-Droid version recommended)
- Internet connection for installation

## Quick Install

```bash
curl -sL https://raw.githubusercontent.com/Franzferdinan51/DuckHive/main/scripts/duckhive-android/install.sh | bash
```

## Features

- Run DuckHive natively on Android via Termux + glibc-runner
- ~200MB storage footprint (vs 1-2GB for proot-distro)
- Native speed performance
- Built-in Android control tools (ADB wrapper)
- Screen mirroring support via scrcpy

## Commands

After installation, use `duckhive` or `dh` command:

```bash
dh update              # Update DuckHive
dh backup              # Backup config and skills
dh restore             # Restore from backup
dh android screenshot  # Take device screenshot
dh android tap 500 500 # Tap screen coordinates
dh android swipe 100 500 300 500  # Swipe gesture
dh android text "hello"  # Input text
dh onboard             # Initial setup
dh gateway             # Start gateway mode
dh status              # Show status
```

## How It Works

1. Uses Termux's glibc-runner package (ld.so wrapper)
2. Wraps standard Linux Node.js binaries with Android-compatible loader
3. Auto-converts Linux paths to Termux paths
4. No need for proot-distro (much faster/smaller)

## Uninstall

```bash
/data/data/com.termux/files/opt/duckhive/uninstall.sh
```
