package bridge

import (
	"bufio"
	"encoding/json"
	"io"
	"testing"
	"time"

	"github.com/gitlawb/duckhive/tui/model"
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

func TestHandleFramePublishesTaskLifecycleMessages(t *testing.T) {
	adapter := NewSubprocessAdapter("duckhive")

	adapter.handleFrame([]byte(`{
		"type":"system",
		"subtype":"task_started",
		"task_id":"task-1",
		"description":"Search docs"
	}`))

	select {
	case msg := <-adapter.Subscription():
		started, ok := msg.(model.MsgTaskStarted)
		if !ok {
			t.Fatalf("message type = %T, want model.MsgTaskStarted", msg)
		}
		if started.ID != "task-1" || started.Desc != "Search docs" {
			t.Fatalf("started = %+v", started)
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatal("timed out waiting for task_started")
	}

	adapter.handleFrame([]byte(`{
		"type":"system",
		"subtype":"task_notification",
		"task_id":"task-1",
		"status":"completed"
	}`))

	select {
	case msg := <-adapter.Subscription():
		ended, ok := msg.(model.MsgTaskEnded)
		if !ok {
			t.Fatalf("message type = %T, want model.MsgTaskEnded", msg)
		}
		if ended.ID != "task-1" {
			t.Fatalf("ended.ID = %q, want task-1", ended.ID)
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatal("timed out waiting for task_notification")
	}
}

func TestHandleFrameClearsTasksWhenSessionGoesIdle(t *testing.T) {
	adapter := NewSubprocessAdapter("duckhive")

	adapter.handleFrame([]byte(`{
		"type":"system",
		"subtype":"session_state_changed",
		"status":"idle"
	}`))

	select {
	case msg := <-adapter.Subscription():
		if _, ok := msg.(model.MsgTasksCleared); !ok {
			t.Fatalf("message type = %T, want model.MsgTasksCleared", msg)
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatal("timed out waiting for session idle task clear")
	}
}
