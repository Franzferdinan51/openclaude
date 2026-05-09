#!/bin/bash
# DuckHive Auto-Update Script - Runs every 2 hours
# ONLY applies bug fixes and enhancements - no new features

set -e

LOGFILE="$HOME/.openclaw/logs/duckhive-update-cron.log"
GIT_DIR="$HOME/Desktop/DuckHive-git"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

log "=== DuckHive Auto-Update Starting (fixes/enhancements only) ==="

cd "$GIT_DIR" || exit 1

# Only pull if there are updates - don't add new features
log "Checking for updates..."
git fetch origin
CURRENT=$(git rev-parse HEAD)
UPSTREAM=$(git rev-parse origin/main)

if [ "$CURRENT" != "$UPSTREAM" ]; then
    log "Pulling: $CURRENT -> $UPSTREAM"
    git pull origin main
    
    # Rebuild to ensure everything compiles
    log "Rebuilding..."
    if bun run build 2>&1 | tee -a "$LOGFILE"; then
        log "Build successful"
        # Only push build artifacts (dist changes)
        if git status --porcelain | grep -q "dist/"; then
            git add dist/
            git commit -m "build: auto-rebuild $(date '+%Y-%m-%d %H:%M')"
            git push origin main
            log "Pushed build artifacts"
        else
            log "No build artifacts to push"
        fi
    else
        log "Build FAILED - skipping push"
    fi
else
    log "Already up to date at $CURRENT"
fi

log "=== DuckHive Auto-Update Complete ==="
