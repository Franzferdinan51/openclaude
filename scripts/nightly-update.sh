#!/bin/bash
# DuckHive Auto-Update - Hourly
# ONLY applies bug fixes/enhancements - no new features

set -e

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/bin:$HOME/.local/bin"
LOGFILE="$HOME/.openclaw/logs/duckhive-update-cron.log"
GIT_DIR="$HOME/Desktop/DuckHive-git"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"; }

log "=== DuckHive Auto-Update Starting ==="

cd "$GIT_DIR" || { log "ERROR: Cannot cd to $GIT_DIR"; exit 1; }

# Ensure executable
chmod +x "$GIT_DIR/scripts/nightly-update.sh" 2>/dev/null || true

# Pull latest
log "Checking for updates..."
git fetch origin 2>&1 | tee -a "$LOGFILE"

HEAD=$(git rev-parse HEAD)
UPSTREAM=$(git rev-parse '@{upstream}')
if [ "$HEAD" = "$UPSTREAM" ]; then
    log "Already up to date at $(git rev-parse --short HEAD)"
else
    log "Updates available, pulling..."
    git pull origin main 2>&1 | tee -a "$LOGFILE"
    
    # Rebuild if package.json changed
    if git diff --name-only HEAD~1 | grep -q "package.json"; then
        log "package.json changed, reinstalling..."
        npm install 2>&1 | tee -a "$LOGFILE"
    fi
    
    log "Build..."
    npm run build 2>&1 | tee -a "$LOGFILE"
    log "Built at $(git rev-parse --short HEAD)"
fi

log "=== DuckHive Auto-Update Complete ==="
