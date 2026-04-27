#!/bin/bash
# =============================================================================
# DuckHive Nightly Autonomy — Bug check, fix, verify, push
# =============================================================================
# Runs every night at 2 AM via:
#   0 2 * * * ~/.gitnexus/repos/DuckHive/scripts/nightly-autonomy.sh
# =============================================================================

set -euo pipefail

REPO="$HOME/.gitnexus/repos/DuckHive"
LOG_DIR="$HOME/.openclaw/logs"
REPORT_DIR="$HOME/.openclaw/logs/duckhive-nightly"
BUILD_LOG="$REPORT_DIR/build-$(date +%Y%m%d).log"
REPORT_FILE="$REPORT_DIR/report-$(date +%Y%m%d).txt"

mkdir -p "$LOG_DIR" "$REPORT_DIR"

# =============================================================================
# Helpers
# =============================================================================

log() {
  local ts; ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts] $*"
  echo "[$ts] $*" >> "$BUILD_LOG"
}

run() {
  log "RUN: $*"
  "$@" >> "$BUILD_LOG" 2>&1
}

report_header() {
  echo "=============================================" >> "$REPORT_FILE"
  echo "DuckHive Nightly — $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
  echo "=============================================" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
}

append() {
  echo "$*" >> "$REPORT_FILE"
}

# =============================================================================
# Phase 0 — Environment check
# =============================================================================

log "=== Phase 0: Environment ==="

if ! command -v bun &>/dev/null; then
  log "ERROR: bun not found in PATH"
  exit 1
fi

if ! command -v node &>/dev/null; then
  log "ERROR: node not found in PATH"
  exit 1
fi

log "bun: $(bun --version)"
log "node: $(node --version)"
log "Repo: $REPO"

cd "$REPO"

# =============================================================================
# Phase 1 — Git pull (get latest from remote)
# =============================================================================

log "=== Phase 1: Git Pull ==="

run git fetch origin main
run git checkout main
run git reset --hard origin/main

if git status | grep -q "behind"; then
  run git pull --ff-only origin main
fi

COMMIT=$(git rev-parse --short HEAD)
log "On commit: $COMMIT — $(git log -1 --oneline)"

# =============================================================================
# Phase 2 — Dependency install
# =============================================================================

log "=== Phase 2: Dependencies ==="

if [ -f "$REPO/package.json" ]; then
  run bun install --frozen-lockfile 2>&1 || {
    log "FROZEN LOCKFILE FAILED, retrying without..."
    run bun install
  }
else
  log "WARN: package.json not found, skipping install"
fi

# =============================================================================
# Phase 3 — TypeScript check (fast, catches type errors)
# =============================================================================

log "=== Phase 3: TypeScript Check ==="

TS_START=$(date +%s)
if run bun run typecheck 2>&1; then
  TYPECHECK_OK=true
  log "TypeScript: PASS"
else
  TYPECHECK_OK=false
  TS_ERRORS=$(grep -c "error TS" "$BUILD_LOG" 2>/dev/null || echo "?")
  log "TypeScript: FAIL ($TS_ERRORS errors)"
fi
TS_END=$(date +%s)
TS_DURATION=$((TS_END - TS_START))

# =============================================================================
# Phase 4 — Build
# =============================================================================

log "=== Phase 4: Build ==="

BUILD_START=$(date +%s)
if run bun run build 2>&1; then
  BUILD_OK=true
  log "Build: PASS"
else
  BUILD_OK=false
  log "Build: FAIL"
fi
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

# Check binary exists
if [ -f "$REPO/bin/duckhive" ] || [ -f "$REPO/dist/cli.mjs" ]; then
  BINARY_OK=true
  log "Binary: EXISTS"
else
  BINARY_OK=false
  log "Binary: MISSING"
fi

# =============================================================================
# Phase 5 — Tests
# =============================================================================

log "=== Phase 5: Tests ==="

TEST_START=$(date +%s)
if run bun run test 2>&1; then
  TEST_OK=true
  TEST_FAIL_COUNT=0
  log "Tests: PASS"
else
  TEST_OK=false
  TEST_FAIL_COUNT=$(grep -c "FAIL\|fail\|ERROR" "$BUILD_LOG" 2>/dev/null || echo "1")
  log "Tests: FAIL"
fi
TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))

# =============================================================================
# Phase 6 — Doctor / System check
# =============================================================================

log "=== Phase 6: Doctor / System Check ==="

DOCTOR_START=$(date +%s)
if run bun run doctor:runtime 2>&1; then
  DOCTOR_OK=true
  log "Doctor: PASS"
else
  DOCTOR_OK=false
  log "Doctor: FAIL (non-fatal)"
fi
DOCTOR_END=$(date +%s)
DOCTOR_DURATION=$((DOCTOR_END - DOCTOR_START))

# =============================================================================
# Phase 7 — Backend smoke test (starts + exits cleanly)
# =============================================================================

log "=== Phase 7: Backend Smoke Test ==="

SMOKE_START=$(date +%s)
if [ -f "$REPO/dist/cli.mjs" ]; then
  # Try --version as a smoke test (fast, no blocking)
  if timeout 15 node "$REPO/dist/cli.mjs" --version >> "$BUILD_LOG" 2>&1; then
    SMOKE_OK=true
    log "Smoke (version): PASS"
  else
    # Try --help as fallback
    if timeout 15 node "$REPO/dist/cli.mjs" --help >> "$BUILD_LOG" 2>&1; then
      SMOKE_OK=true
      log "Smoke (help): PASS"
    else
      SMOKE_OK=false
      log "Smoke: FAIL (could not start CLI)"
    fi
  fi
else
  SMOKE_OK=false
  log "Smoke: SKIP (no dist/cli.mjs)"
fi
SMOKE_END=$(date +%s)
SMOKE_DURATION=$((SMOKE_END - SMOKE_START))

# =============================================================================
# Phase 8 — Try privacy / phone-home check
# =============================================================================

log "=== Phase 8: Privacy Check ==="

PRIVACY_START=$(date +%s)
if run bun run verify:privacy 2>&1; then
  PRIVACY_OK=true
  log "Privacy check: PASS"
else
  PRIVACY_OK=false
  log "Privacy check: FAIL (non-fatal, will not block push)"
fi
PRIVACY_END=$(date +%s)
PRIVACY_DURATION=$((PRIVACY_END - PRIVACY_START))

# =============================================================================
# Phase 9 — Auto-fix common issues
# =============================================================================

log "=== Phase 9: Auto-fix ==="

FIXES=0

# Fix 1: Missing .env.example (creates from .env if exists)
if [ -f "$REPO/.env" ] && [ ! -f "$REPO/.env.example" ]; then
  cp "$REPO/.env" "$REPO/.env.example"
  sed -i '' 's/=.*/=/' "$REPO/.env.example" 2>/dev/null || \
  sed -i 's/=.*/=/' "$REPO/.env.example" 2>/dev/null || true
  log "AUTO-FIX: Created .env.example"
  FIXES=$((FIXES + 1))
fi

# Fix 2: Ensure .gitignore is present
if [ ! -f "$REPO/.gitignore" ]; then
  cat > "$REPO/.gitignore" << 'GITIGNORE_EOF'
node_modules/
dist/
*.tsbuildinfo
.env
.env.*
!.env.example
.openclaude-profile.json
reports/
GITIGNORE_EOF
  log "AUTO-FIX: Created .gitignore"
  FIXES=$((FIXES + 1))
fi

# Fix 3: Ensure AGENTS.md exists (project tracking file)
if [ ! -f "$REPO/AGENTS.md" ]; then
  cat > "$REPO/AGENTS.md" << 'AGENTS_EOF'
# DuckHive Agent Tracking

This file is auto-generated by DuckHive's nightly autonomy engine.
Last updated: __TIMESTAMP__
AGENTS_EOF
  sed -i '' "s/__TIMESTAMP__/$(date '+%Y-%m-%d %H:%M')/" "$REPO/AGENTS.md" 2>/dev/null || \
  sed -i "s/__TIMESTAMP__/$(date '+%Y-%m-%d %H:%M')/" "$REPO/AGENTS.md" 2>/dev/null || true
  log "AUTO-FIX: Created AGENTS.md"
  FIXES=$((FIXES + 1))
fi

# Fix 4: Ensure bin/duckhive is executable
if [ -f "$REPO/bin/duckhive" ]; then
  chmod +x "$REPO/bin/duckhive" 2>/dev/null || true
fi

if [ $FIXES -eq 0 ]; then
  log "No auto-fixes needed"
else
  log "Applied $FIXES auto-fix(es)"
fi

# =============================================================================
# Phase 10 — Git commit fixes if needed
# =============================================================================

log "=== Phase 10: Commit Fixes ==="

run git add -A

if git diff --cached --quiet; then
  log "No changes to commit"
else
  run git commit -m "nightly $(date '+%Y-%m-%d') — auto-fix $FIXES issue(s), typecheck ${TYPECHECK_OK:+pass}${TYPECHECK_OK:-fail}"

  # Try to push, but don't block on this
  if git push origin main >> "$BUILD_LOG" 2>&1; then
    log "PUSH: SUCCESS"
    PUSH_OK=true
  else
    log "PUSH: FAILED (may have new remote commits)"
    PUSH_OK=false
    # Try pull + merge + push once
    if git pull --no-edit origin main >> "$BUILD_LOG" 2>&1; then
      if git push origin main >> "$BUILD_LOG" 2>&1; then
        log "PUSH (after merge): SUCCESS"
        PUSH_OK=true
      fi
    fi
  fi
fi

# =============================================================================
# Phase 11 — Final Report
# =============================================================================

FINAL_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
FINAL_STATUS="UNCHANGED"
if git status | grep -q "Your branch is ahead"; then
  FINAL_STATUS="COMMITTED"
fi

# Check if we need to push
run git status

# =============================================================================
# Build Report
# =============================================================================

TOTAL_DURATION=$(( $(date +%s) - BUILD_START ))

{
  report_header

  append "## Result Summary"
  append "| Check            | Status |"
  append "|-----------------|--------|"
  append "| TypeScript      | $([ "$TYPECHECK_OK" = true ] && echo '✅ PASS' || echo '❌ FAIL') |"
  append "| Build            | $([ "$BUILD_OK" = true ] && echo '✅ PASS' || echo '❌ FAIL') |"
  append "| Binary exists    | $([ "$BINARY_OK" = true ] && echo '✅ YES' || echo '❌ NO') |"
  append "| Tests            | $([ "$TEST_OK" = true ] && echo '✅ PASS' || echo '⚠️ FAIL') |"
  append "| Doctor           | $([ "$DOCTOR_OK" = true ] && echo '✅ PASS' || echo '⚠️ FAIL') |"
  append "| Smoke test       | $([ "$SMOKE_OK" = true ] && echo '✅ PASS' || echo '❌ FAIL') |"
  append "| Privacy check    | $([ "$PRIVACY_OK" = true ] && echo '✅ PASS' || echo '⚠️ WARN') |"
  append "| Auto-fixes       | $FIXES |"
  append "| Git push         | $([ "${PUSH_OK:-false}" = true ] && echo '✅ OK' || echo '⚠️ SKIP/RETRY') |"
  append ""
  append "## Timings"
  append "- TypeScript: ${TS_DURATION}s"
  append "- Build: ${BUILD_DURATION}s"
  append "- Tests: ${TEST_DURATION}s"
  append "- Doctor: ${DOCTOR_DURATION}s"
  append "- Smoke: ${SMOKE_DURATION}s"
  append "- Privacy: ${PRIVACY_DURATION}s"
  append "- Total: ${TOTAL_DURATION}s"
  append ""
  append "## Commit"
  append "- Head: $FINAL_COMMIT"
  append "- Status: $FINAL_STATUS"
  append ""
  append "## Push Result"
  if [ "${PUSH_OK:-false}" = true ]; then
    append "✅ Pushed successfully to origin/main"
  elif [ "$FIXES" -gt 0 ]; then
    append "⚠️ Changes committed locally, push blocked by remote"
  else
    append "ℹ️ No changes to push"
  fi
  append ""
  append "## Next Steps"
  append "- Review report at: $REPORT_FILE"
  append "- Full build log: $BUILD_LOG"
  append "- Check failing phases manually"
  append ""

} >> "$REPORT_FILE"

# =============================================================================
# Push final status
# =============================================================================

FINAL_STATUS_SUM="✅ all green"
if [ "$TYPECHECK_OK" != true ] || [ "$BUILD_OK" != true ] || [ "$SMOKE_OK" != true ]; then
  FINAL_STATUS_SUM="❌ FAILURES — review $REPORT_FILE"
fi

log "=== DONE ==="
log "Result: $FINAL_STATUS_SUM"
log "Report: $REPORT_FILE"
log "Log: $BUILD_LOG"

# =============================================================================
# Telegram notification on failure (if duckhive is working)
# =============================================================================

if [ "$BUILD_OK" != true ] || [ "$SMOKE_OK" != true ]; then
  if command -v node &>/dev/null && [ -f "$REPO/dist/cli.mjs" ]; then
    log "Sending failure alert..."
    # Best-effort alert — don't block on this
    timeout 10 node "$REPO/dist/cli.mjs" \
      --message "🦆 DuckHive nightly: FAILURES DETECTED — $FINAL_STATUS_SUM — Report: $REPORT_FILE" \
      >> "$BUILD_LOG" 2>&1 || true
  fi
fi

# Exit 0 always — we committed fixes even if tests had issues
# Non-zero only if we couldn't even build
if [ "$BUILD_OK" != true ]; then
  exit 1
fi
exit 0
