package tui

import (
	"fmt"
	"os"
	"sync"
	"time"
)

// LoaderStyle defines the animation shown while waiting for a response.
type LoaderStyle int

const (
	// LoaderSpinner uses Braille dot frames (⠋⠙⠹…)
	LoaderSpinner LoaderStyle = iota
	// LoaderGradient cycles letters through ANSI 256 colors (shimmer)
	LoaderGradient
	// LoaderMinimal shows trailing dots (Working·  Working··  Working···)
	LoaderMinimal
)

// Loader displays an animated status line while the model is working.
// All styles write directly to stdout and clean up after themselves.
type Loader struct {
	Style    LoaderStyle
	Text     string
	frame    int
	running  bool
	mu       sync.Mutex
	stopChan chan struct{}
}

// LoaderConfig holds the parameters for a Loader.
type LoaderConfig struct {
	Style LoaderStyle
	Text  string
}

// NewLoader creates a Loader with the given config (default: spinner, "Working").
func NewLoader(cfg LoaderConfig) *Loader {
	text := cfg.Text
	if text == "" {
		text = "Working"
	}
	style := cfg.Style
	if style != LoaderGradient && style != LoaderMinimal {
		style = LoaderSpinner
	}
	return &Loader{
		Style:    style,
		Text:     text,
		stopChan: make(chan struct{}),
	}
}

// Start begins the animation loop in a goroutine.
func (l *Loader) Start() {
	l.mu.Lock()
	if l.running {
		l.mu.Unlock()
		return
	}
	l.running = true
	l.frame = 0
	l.mu.Unlock()

	go func() {
		interval := 80 * time.Millisecond
		if l.Style == LoaderMinimal {
			interval = 300 * time.Millisecond
		} else if l.Style == LoaderGradient {
			interval = 150 * time.Millisecond
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				l.draw()
			case <-l.stopChan:
				l.erase()
				return
			}
		}
	}()
}

// Stop halts the animation and erases the loader line.
func (l *Loader) Stop() {
	l.mu.Lock()
	if !l.running {
		l.mu.Unlock()
		return
	}
	l.running = false
	close(l.stopChan)
	l.stopChan = make(chan struct{})
	l.mu.Unlock()
}

func (l *Loader) draw() {
	if !l.running {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	const (
		DIM   = "\x1b[2m"
		RESET = "\x1b[0m"
	)
	f := l.frame
	l.frame++

	switch l.Style {
	case LoaderMinimal:
		dots := [3]string{"·", "··", "···"}
		fmt.Fprintf(os.Stdout, "\r%s%s%s%s", DIM, l.Text, dots[f%3], RESET)
	case LoaderGradient:
		colors := []string{
			"\x1b[38;5;240m",
			"\x1b[38;5;245m",
			"\x1b[38;5;250m",
			"\x1b[38;5;255m",
			"\x1b[38;5;250m",
			"\x1b[38;5;245m",
		}
		fmt.Fprintf(os.Stdout, "\r")
		for i := range l.Text {
			c := colors[(f+i)%len(colors)]
			fmt.Fprintf(os.Stdout, "%s%c", c, l.Text[i])
		}
		fmt.Fprint(os.Stdout, RESET)
	case LoaderSpinner:
		frames := [10]string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
		fmt.Fprintf(os.Stdout, "\r%s%s %s%s", DIM, frames[f%len(frames)], l.Text, RESET)
	}
}

func (l *Loader) erase() {
	fmt.Fprint(os.Stdout, "\r\x1b[2K")
}

// ProgressLoader is a simpler alias used by view.go and update.go.
type ProgressLoader = Loader

// NewProgressLoader creates a Loader with default spinner style.
func NewProgressLoader() *ProgressLoader {
	return NewLoader(LoaderConfig{Text: "Working"})
}
