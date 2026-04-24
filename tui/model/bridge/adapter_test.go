package bridge

import (
	"bufio"
	"encoding/json"
	"io"
	"testing"
	"time"
)

func TestWriteLoopWritesToSubprocessStdinWithoutSocket(t *testing.T) {
	adapter := NewSubprocessAdapter("duckhive")
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()

	adapter.stdin = writer

	done := make(chan struct{})
	go func() {
		adapter.writeLoop()
		close(done)
	}()

	readLine := make(chan string, 1)
	readErr := make(chan error, 1)
	go func() {
		line, err := bufio.NewReader(reader).ReadString('\n')
		if err != nil {
			readErr <- err
			return
		}
		readLine <- line
	}()

	adapter.outbound <- json.RawMessage(`{"type":"user_message","text":"hello"}`)

	select {
	case line := <-readLine:
		if line != "{\"type\":\"user_message\",\"text\":\"hello\"}\n" {
			t.Fatalf("line = %q", line)
		}
	case err := <-readErr:
		t.Fatalf("read failed: %v", err)
	case <-done:
		t.Fatal("writeLoop exited before writing subprocess payload")
	case <-time.After(250 * time.Millisecond):
		t.Fatal("timed out waiting for subprocess payload")
	}

	adapter.mu.Lock()
	adapter.closed = true
	adapter.mu.Unlock()
	writer.Close()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("writeLoop did not exit after adapter close")
	}
}
