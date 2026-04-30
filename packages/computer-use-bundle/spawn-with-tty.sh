#!/bin/bash
# spawn-with-tty.sh — Wrapper that spawns a macOS binary via a PTY
# to satisfy hardened runtime launch constraints on macOS 26.3+.
# Usage: spawn-with-tty.sh <binary> [args...]
# Outputs JSON-RPC on stdout from the spawned process.
set -e

BINARY="$1"
shift
if [ -z "$BINARY" ]; then
  echo "Usage: spawn-with-tty.sh <binary> [args...]" >&2
  exit 1
fi

if [ ! -x "$BINARY" ]; then
  echo "Error: $BINARY is not executable" >&2
  exit 1
fi

# Use Python's pty module to allocate a controlling TTY.
# The child becomes session leader with the PTY as controlling terminal.
# This satisfies macOS 26.3's hardened runtime "Launch Constraint" for
# processes that require a TTY session context (like SkyComputerUseClient).
exec python3 "${BASH_SOURCE[0]%/*}/spawn-pty.py" "$BINARY" "$@"