package bridge

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/charmbracelet/bubbletea"
	"github.com/gitlawb/duckhive/tui/model"
)

// Adapter connects the Bubble Tea TUI to the TypeScript backend.
// It can either connect via Unix socket or spawn the TS bridge as a subprocess.
type Adapter struct {
	mu         sync.RWMutex
	socketPath string
	conn       net.Conn
	inbound    chan model.InMsg
	outbound   chan json.RawMessage
	ctx        context.Context
	cancel     context.CancelFunc
	closed     bool

	// For subprocess mode
	bridgeCmd  string
	bridgeArgs []string
	proc       *os.Process
}

// NewAdapter creates a bridge adapter for the given socket path.
func NewAdapter(socketPath string) *Adapter {
	return &Adapter{
		socketPath: socketPath,
		inbound:    make(chan model.InMsg, 100),
		outbound:   make(chan json.RawMessage, 100),
	}
}

// NewSubprocessAdapter creates a bridge that spawns a given command.
// Pass the path to the TS bridge entry point.
func NewSubprocessAdapter(bridgeCmd string, args ...string) *Adapter {
	return &Adapter{
		bridgeCmd:  bridgeCmd,
		bridgeArgs: args,
		inbound:    make(chan model.InMsg, 100),
		outbound:   make(chan json.RawMessage, 100),
	}
}

// Start initiates the bridge connection. Returns a Bubble Tea command.
func (a *Adapter) Start() tea.Cmd {
	return func() tea.Msg {
		if a.bridgeCmd != "" {
			if err := a.startSubprocess(); err != nil {
				return model.MsgBridgeDisconnected{Err: err}
			}
		} else {
			if err := a.connect(); err != nil {
				return model.MsgBridgeDisconnected{Err: err}
			}
		}
		return model.MsgBridgeConnected{}
	}
}

// connect opens the Unix socket.
func (a *Adapter) connect() error {
	conn, err := net.DialTimeout("unix", a.socketPath, 5*time.Second)
	if err != nil {
		return fmt.Errorf("dial %s: %w", a.socketPath, err)
	}
	a.conn = conn
	go a.readLoop()
	go a.writeLoop()
	return nil
}

// startSubprocess spawns the TS bridge as a child process.
func (a *Adapter) startSubprocess() error {
	a.ctx, a.cancel = context.WithCancel(context.Background())

	cmd := exec.CommandContext(a.ctx, a.bridgeCmd, a.bridgeArgs...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start bridge: %w", err)
	}
	a.proc = cmd.Process

	go a.readFrom(stdout)
	go a.readErrors(stderr)

	go func() {
		cmd.Wait()
		a.mu.Lock()
		a.closed = true
		a.mu.Unlock()
		select {
		case a.inbound <- model.MsgBridgeDisconnected{Err: fmt.Errorf("bridge process exited")}:
		default:
		}
	}()

	return nil
}

// Send queues a JSON message to the backend.
func (a *Adapter) Send(payload json.RawMessage) error {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.closed {
		return fmt.Errorf("bridge closed")
	}
	select {
	case a.outbound <- payload:
		return nil
	default:
		return fmt.Errorf("outbound channel full")
	}
}

// Close terminates the bridge connection.
func (a *Adapter) Close() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.closed = true
	if a.cancel != nil {
		a.cancel()
	}
	if a.conn != nil {
		a.conn.Close()
	}
	if a.proc != nil {
		a.proc.Signal(syscall.SIGTERM)
	}
	return nil
}

// Subscription returns the channel for receiving inbound messages.
func (a *Adapter) Subscription() <-chan model.InMsg {
	return a.inbound
}

// readLoop pumps JSON messages from the socket to the inbound channel.
func (a *Adapter) readLoop() {
	dec := json.NewDecoder(a.conn)
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			if err == io.EOF {
				return
			}
			select {
			case a.inbound <- model.MsgError{Err: err}:
			default:
			}
			return
		}
		a.handleFrame(raw)
	}
}

// readFrom pumps JSON messages from a reader (subprocess stdout).
func (a *Adapter) readFrom(r io.Reader) {
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		raw := sc.Bytes()
		a.handleFrame(raw)
	}
}

// readErrors pumps stderr lines as error messages.
func (a *Adapter) readErrors(r io.Reader) {
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		select {
		case a.inbound <- model.MsgError{Err: fmt.Errorf("bridge: %s", sc.Text())}:
		default:
		}
	}
}

// writeLoop pumps outbound messages from the channel to the socket.
func (a *Adapter) writeLoop() {
	for {
		a.mu.RLock()
		closed := a.closed
		conn := a.conn
		a.mu.RUnlock()
		if closed || conn == nil {
			return
		}

		select {
		case payload := <-a.outbound:
			data := append(payload, '\n')
			if _, err := conn.Write(data); err != nil {
				return
			}
		default:
			time.Sleep(10 * time.Millisecond)
		}
	}
}

// handleFrame parses a raw JSON frame into a model.InMsg.
func (a *Adapter) handleFrame(raw []byte) {
	var f struct {
		Type string `json:"type"`
		ID   string `json:"id,omitempty"`
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		return
	}

	var msg model.InMsg
	switch f.Type {
	case "message":
		var m model.Message
		if err := json.Unmarshal(raw, &m); err == nil {
			msg = model.MsgMessageReceived{Message: m}
		}
	case "stream_delta":
		var d struct {
			ID    string `json:"id"`
			Delta string `json:"delta"`
		}
		if err := json.Unmarshal(raw, &d); err == nil {
			msg = model.MsgStreamDelta{MessageID: d.ID, Delta: d.Delta}
		}
	case "stream_end":
		var d struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(raw, &d); err == nil {
			msg = model.MsgStreamEnd{MessageID: d.ID}
		}
	case "thinking_start":
		msg = model.MsgThinkingStarted{}
	case "thinking_end":
		msg = model.MsgThinkingEnded{}
	case "permission_request":
		var req model.PermissionRequest
		if err := json.Unmarshal(raw, &req); err == nil {
			msg = model.MsgPermissionRequest{Request: req}
		}
	case "error":
		var e struct {
			Err string `json:"error"`
		}
		if err := json.Unmarshal(raw, &e); err == nil {
			msg = model.MsgError{Err: fmt.Errorf("%s", e.Err)}
		}
	case "cost":
		var c struct {
			Cost float64 `json:"cost"`
		}
		if err := json.Unmarshal(raw, &c); err == nil {
			msg = model.MsgCostReceived{Cost: c.Cost}
		}
	case "tokens":
		var t model.TokenUsage
		if err := json.Unmarshal(raw, &t); err == nil {
			msg = model.MsgTokensReceived{Usage: t}
		}
	default:
		return
	}

	if msg != nil {
		select {
		case a.inbound <- msg:
		default:
		}
	}
}

// SendUserMessageCmd creates a command to send a user message.
func SendUserMessageCmd(bridge *Adapter, text string) tea.Cmd {
	return func() tea.Msg {
		payload, _ := json.Marshal(map[string]any{
			"type": "user_message",
			"text": text,
			"time": time.Now().Unix(),
		})
		if err := bridge.Send(payload); err != nil {
			return model.MsgError{Err: err}
		}
		return nil
	}
}

// SendInterruptCmd creates a command to interrupt the backend.
func SendInterruptCmd(bridge *Adapter) tea.Cmd {
	return func() tea.Msg {
		payload, _ := json.Marshal(map[string]any{"type": "interrupt"})
		if err := bridge.Send(payload); err != nil {
			return model.MsgError{Err: err}
		}
		return nil
	}
}

// BridgeSubscription creates a Bubble Tea subscription from a bridge adapter.
func BridgeSubscription(bridge *Adapter) func(msg tea.Msg) bool {
	return func(msg tea.Msg) bool {
		switch msg.(type) {
		case model.InMsg:
			return true
		default:
			return false
		}
	}
}
