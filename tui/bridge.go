package tui

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/charmbracelet/bubbletea"
)

// BridgeConfig holds Unix socket bridge settings.
type BridgeConfig struct {
	SocketPath string
	OnMessage func(msg BackendEventMsg)
	OnError   func(err error)
	OnConnect func()
}

// Bridge connects the TUI to the TypeScript backend via a Unix socket.
type Bridge struct {
	config BridgeConfig
	conn   net.Conn
	mu     sync.Mutex
	closed bool
}

// NewBridge creates a bridge with the given config.
func NewBridge(config BridgeConfig) *Bridge {
	return &Bridge{config: config}
}

// Start opens the Unix socket and streams messages to the model.
func (b *Bridge) Start() error {
	conn, err := net.Dial("unix", b.config.SocketPath)
	if err != nil {
		return fmt.Errorf("bridge dial: %w", err)
	}
	b.conn = conn
	b.config.OnConnect()

	go b.readLoop()
	return nil
}

// Send writes a JSON message to the backend.
func (b *Bridge) Send(msg interface{}) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return fmt.Errorf("bridge closed")
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	_, err = b.conn.Write(data)
	return err
}

// Close shuts down the bridge connection.
func (b *Bridge) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed = true
	if b.conn != nil {
		return b.conn.Close()
	}
	return nil
}

// readLoop pumps messages from the socket to callbacks.
// Uses bufio.Reader + json.Decoder to avoid per-message heap allocation
// from json.RawMessage ([]byte) which caused OOM on heavy/long sessions.
func (b *Bridge) readLoop() {
	// bufio.Reader reuses a fixed internal buffer (typically 4KB) instead of
	// allocating a new []byte for every Decode() call like json.Decoder on a
	// bare net.Conn would.
	reader := bufio.NewReaderSize(b.conn, 4096)
	dec := json.NewDecoder(reader)

	for {
		var evt BackendEventMsg
		// Decode directly into the target struct — no intermediate json.RawMessage
		// allocation. json.Decoder reuses its internal token buffer as well.
		if err := dec.Decode(&evt); err != nil {
			if err == io.EOF || b.closed {
				return
			}
			b.config.OnError(err)
			return
		}
		b.config.OnMessage(evt)
	}
}

// MakeBridgeCmd returns a Bubble Tea command that starts the bridge
// and streams events into the model's Update loop.
func MakeBridgeCmd(bridge *Bridge, model *Model) tea.Cmd {
	return func() tea.Msg {
		if err := bridge.Start(); err != nil {
			return BridgeErrMsg{Err: err}
		}
		return BridgeConnectedMsg{}
	}
}

// BridgeConnectedMsg signals the bridge is ready.
type BridgeConnectedMsg struct{}

// BridgeErrMsg signals a bridge error.
type BridgeErrMsg struct{ Err error }

// SendUserInputCmd creates a command to send user input through the bridge.
func SendUserInputCmd(bridge *Bridge, text string) tea.Cmd {
	return func() tea.Msg {
		err := bridge.Send(map[string]interface{}{
			"type": "user_message",
			"text": text,
			"time": time.Now().Unix(),
		})
		if err != nil {
			return BridgeErrMsg{Err: err}
		}
		return nil
	}
}
