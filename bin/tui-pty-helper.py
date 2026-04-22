#!/usr/bin/env python3
"""Launch DuckHive TUI with proper PTY on macOS."""
import pty, os, sys, select, signal, time

def launch():
    tui_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tui', 'duckhive-tui')
    args = sys.argv[1:] if len(sys.argv) > 1 else []

    pid, master_fd = pty.fork()
    if pid == 0:
        # Child - exec the TUI
        os.execvp(tui_path, [tui_path] + args)
        return

    # Parent - relay between stdin and PTY master
    def write_all(fd, data):
        try:
            os.write(fd, data)
        except OSError:
            pass

    def read_all(fd, buf_size=4096):
        try:
            return os.read(fd, buf_size)
        except OSError:
            return b''

    running = True
    while running:
        r, _, _ = select.select([master_fd, sys.stdin], [], [], 0.1)
        if master_fd in r:
            data = read_all(master_fd)
            if data:
                sys.stdout.buffer.write(data)
            else:
                running = False
        if sys.stdin in r:
            try:
                data = os.read(sys.stdin.fileno(), 4096)
                if data:
                    write_all(master_fd, data)
                else:
                    # EOF on stdin
                    pass
            except OSError:
                running = False

    # Drain remaining output
    time.sleep(0.1)
    while True:
        r, _, _ = select.select([master_fd], [], [], 0.5)
        if not r:
            break
        data = read_all(master_fd)
        if not data:
            break
        sys.stdout.buffer.write(data)

    try: os.close(master_fd)
    except: pass

    try:
        result = os.waitpid(pid, 0)
        return result[1]
    except:
        return 0

if __name__ == '__main__':
    code = launch()
    sys.exit(code if code else 0)
