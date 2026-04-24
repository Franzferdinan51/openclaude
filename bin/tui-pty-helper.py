#!/usr/bin/env python3
"""Launch DuckHive TUI with proper PTY on macOS."""
import os, sys, select, pty, fcntl, struct, termios

sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', buffering=1)
os.environ['PYTHONUNBUFFERED'] = '1'

def is_tty(fd):
    try:
        fcntl.ioctl(fd, termios.TIOCGWINSZ)
        return True
    except OSError:
        return False

def set_window_size(fd, rows=24, cols=80):
    """Set PTY window size so Go gets SIGWINCH on startup."""
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except OSError:
        pass

def launch():
    tui = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tui', 'duckhive-tui')
    args = sys.argv[1:] if len(sys.argv) > 1 else []

    stdin_fd = sys.stdin.fileno() if hasattr(sys.stdin, 'fileno') else -1
    if stdin_fd >= 0 and not is_tty(stdin_fd):
        os.execvp(tui, [tui] + args)
        return

    pid, master = pty.fork()
    if pid == 0:
        slave = os.ttyname(master)
        os.environ['TTY'] = slave
        os.close(master)
        os.execvp(tui, [tui] + args)
        return

    # Get terminal size from stdin and apply to PTY master
    try:
        winsize = fcntl.ioctl(stdin_fd, termios.TIOCGWINSZ, b'\x00' * 8)
        r, c = struct.unpack('HHHH', winsize)[:2]
        if r > 0 and c > 0:
            set_window_size(master, r, c)
    except:
        set_window_size(master, 40, 120)  # fallback

    try:
        while True:
            r, _, _ = select.select([master, sys.stdin], [], [], 0.1)
            if master in r:
                try:
                    d = os.read(master, 8192)
                    if d:
                        os.write(sys.stdout.fileno(), d)
                    else:
                        break
                except OSError:
                    break
            if sys.stdin in r:
                try:
                    d = os.read(sys.stdin.fileno(), 8192)
                    if d:
                        os.write(master, d)
                except OSError:
                    break
            res = os.waitpid(pid, os.WNOHANG)
            if res[0] != 0:
                break
    finally:
        try:
            # Drain remaining output
            while True:
                r, _, _ = select.select([master], [], [], 0.3)
                if not r: break
                d = os.read(master, 4096)
                if not d: break
                os.write(sys.stdout.fileno(), d)
        except: pass
        try: os.close(master)
        except: pass
        os.waitpid(pid, 0)

if __name__ == '__main__':
    try: launch()
    except KeyboardInterrupt: sys.exit(130)
    except Exception as e:
        sys.stderr.write(f'tui-pty-helper: {e}\n')
        sys.exit(1)
