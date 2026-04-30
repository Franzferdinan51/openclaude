#!/usr/bin/env sh
set -eu

log() {
  printf '[DuckHive install] %s\n' "$*"
}

die() {
  printf '[DuckHive install] error: %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PREFIX=${DUCKHIVE_INSTALL_PREFIX:-"$HOME/.local"}
BIN_DIR="$PREFIX/bin"
LAUNCHER="$BIN_DIR/duckhive"

case "$(uname -s 2>/dev/null || printf unknown)" in
  Darwin) OS_NAME=macOS ;;
  Linux) OS_NAME=Linux ;;
  *) OS_NAME=Unix ;;
esac

log "Installing from $ROOT_DIR on $OS_NAME"

command_exists node || die "Node.js 20+ is required. Install Node.js, then rerun this script."

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js 20+ is required. Found $(node --version)."
fi

if ! command_exists bun; then
  log "Bun was not found. Installing Bun with the official installer."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

command_exists bun || die "Bun install did not put bun on PATH. Open a new shell or add ~/.bun/bin to PATH."

if command_exists git; then
  log "Git detected: $(git --version)"
else
  log "Git not found. DuckHive can run, but repo workflows will be limited."
fi

log "Installing dependencies"
(cd "$ROOT_DIR" && bun install)

log "Building DuckHive"
(cd "$ROOT_DIR" && bun run build)

if command_exists go; then
  log "Building enhanced TUI"
  (cd "$ROOT_DIR/tui" && go build -o duckhive-tui ./cmd/duckhive-tui)
else
  log "Go not found; keeping the existing tui/duckhive-tui binary if present."
fi

mkdir -p "$BIN_DIR"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env sh
exec "$ROOT_DIR/bin/duckhive" "\$@"
EOF
chmod 755 "$LAUNCHER"
chmod 755 "$ROOT_DIR/bin/duckhive" "$ROOT_DIR/bin/openclaude" 2>/dev/null || true
chmod 755 "$ROOT_DIR/bin/tui-pty-helper.py" 2>/dev/null || true

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    log "$BIN_DIR is not currently on PATH."
    log "Add this to your shell profile: export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

log "Installed launcher: $LAUNCHER"
log "Run: duckhive --version"
