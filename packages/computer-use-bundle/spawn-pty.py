#!/usr/bin/env python3
"""
spawn-pty.py — Spawn SkyComputerUseClient with a PTY so macOS hardened runtime allows it.

Usage:
  spawn-pty.py /full/path/to/SkyComputerUseClient mcp [args...]

Uses Python's pty module to allocate a pseudo-TTY.
The child becomes session leader with the PTY as controlling terminal.
Parent bridges PTY master ↔ stdin/stdout so MCP protocol works normally.

Works on macOS 26.3 where hardened runtime rejects bare subprocess spawns.
"""
import os
import sys
import signal
import select
import pty
import tty
import termios
import fcntl

def main():
    if len(sys.argv) < 2:
        print("Usage: spawn-pty.py <binary> [args...]", file=sys.stderr)
        sys.exit(1)

    binary = sys.argv[1]
    args = sys.argv[1:]

    # Allocate PTY pair
    master_fd, slave_fd = pty.openpty()
    
    # Set raw mode on slave so the child sees a clean terminal
    try:
        slave_attrs = termios.tcgetattr(slave_fd)
        # ICANON + ECHO + ECHOE + ECHOK + ECHONL + ICRNL
        slave_attrs[0] &= ~(termios.ICRNL | termios.INLCR)
        slave_attrs[1] &= ~(termios.ECHO | termios.ECHOE | termios.ECHOK | termios.ECHONL)
        termios.tcsetattr(slave_fd, termios.TCSANOW, slave_attrs)
    except termios.error:
        pass

    pid = os.fork()

    if pid == 0:
        # Child
        os.close(master_fd)

        # Become session leader (new session, slave becomes controlling terminal)
        os.setsid()
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        # Dup slave to stdin/stdout/stderr
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(slave_fd)

        # Execute the binary with original env
        os.execvp(binary, args)

    # Parent
    os.close(slave_fd)

    # Set master to non-blocking
    fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    # Also make stdin non-blocking
    stdin_fd = sys.stdin.fileno()
    fl_stdin = fcntl.fcntl(stdin_fd, fcntl.F_GETFL)
    fcntl.fcntl(stdin_fd, fcntl.F_SETFL, fl_stdin | os.O_NONBLOCK)

    running = True
    while running:
        rlist, _, _ = select.select([stdin_fd, master_fd], [], [], 0.5)

        if stdin_fd in rlist:
            try:
                data = os.read(stdin_fd, 4096)
                if data:
                    n = os.write(master_fd, data)
                else:
                    # stdin EOF — signal child
                    pass
            except OSError:
                pass

        if master_fd in rlist:
            try:
                data = os.read(master_fd, 4096)
                if data:
                    os.write(sys.stdout.fileno(), data)
                else:
                    running = False
            except OSError:
                pass

        # Check if child is still alive
        try:
            pid_result = os.waitpid(pid, os.WNOHANG)
            if pid_result[0] != 0:
                running = False
        except ChildProcessError:
            running = False

    os.close(master_fd)
    sys.exit(0)

if __name__ == '__main__':
    main()