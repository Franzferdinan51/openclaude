#!/bin/bash
# DuckHive Auto-Update Script - Runs every 2 hours
# Updates DuckHive from GitHub, rebuilds, and pushes if clean

set -e

LOGFILE="$HOME/.openclaw/logs/duckhive-update-cron.log"
GIT_DIR="$HOME/Desktop/DuckHive-git"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

log "=== DuckHive Auto-Update Starting ==="

cd "$GIT_DIR" || exit 1

# Check if there are uncommitted changes
if git status --porcelain | grep -q .; then
    log "Uncommitted changes found, committing..."
    git add -A
    git commit -m "Auto-commit pending changes $(date '+%Y-%m-%d %H:%M')"
fi

# Pull latest
log "Pulling latest from GitHub..."
git fetch origin
CURRENT=$(git rev-parse HEAD)
UPSTREAM=$(git rev-parse origin/main)

if [ "$CURRENT" != "$UPSTREAM" ]; then
    log "Updates available: $CURRENT -> $UPSTREAM"
    git pull origin main
else
    log "Already up to date at $CURRENT"
fi

# Rebuild DuckHive
log "Rebuilding DuckHive..."
if bun run build 2>&1 | tee -a "$LOGFILE"; then
    log "Build successful"
else
    log "Build FAILED"
    exit 1
fi

# Check if build is clean
if git status --porcelain | grep -q .; then
    log "Pushing changes to GitHub..."
    git push origin main
else
    log "No changes to push"
fi

log "=== DuckHive Auto-Update Complete ==="
