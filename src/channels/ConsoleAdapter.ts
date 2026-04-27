/**
 * ConsoleAdapter.ts — Local TUI/REPL channel adapter for DuckHive
 *
 * Provides a local readline-based REPL as a channel for debugging and
 * local development. Messages typed in the terminal are injected into
 * the agent loop; agent replies are printed to stdout.
 *
 * Inbound:  user types in terminal → receiveMessage() → Message
 * Outbound: agent reply → sendMessage() → printed to stdout
 *
 * Designed for:
 *   - Debugging the agent loop without a real messaging backend
 *   - Local development of channel adapter logic
 *   - BDD-style acceptance tests that drive the agent via typed input
 *
 * The TUI is deliberately minimal (readline REPL) so it works in any terminal
 * over SSH or in a headless environment. It does NOT use ncurses or any
 * terminal UI library — keeping it dependency-free and trivially testable.
 */

import * as readline from 'readline'
import type {
  ChannelAdapter,
  ChannelAdapterConfig,
} from './ChannelAdapter.js'
import { normalizeMessage } from './ChannelAdapter.js'
import type { Message } from '../utils/mailbox.js'

// ─── Config ─────────────────────────────────────────────────────────────────

export interface ConsoleAdapterConfig extends ChannelAdapterConfig {
  /**
   * Prompt string shown to the user. Defaults to '🦆 > '.
   * Set to '' for non-interactive use (e.g., tests).
   */
  prompt?: string
  /**
   * When true, color codes the agent's replies (cyan) and system messages (yellow).
   * Defaults to true.
   */
  colorize?: boolean
  /**
   * Input stream. Defaults to process.stdin.
   * Override for testing with string streams.
   */
  inputStream?: NodeJS.ReadableStream
  /**
   * Output stream. Defaults to process.stdout.
   * Override for testing with capture streams.
   */
  outputStream?: NodeJS.WritableStream
  /**
   * Human-readable label shown in logs. Defaults to 'console'.
   */
  sourceLabel?: string
}

// ─── ANSI color helpers ──────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'

// ─── Adapter ────────────────────────────────────────────────────────────────

export class ConsoleAdapter implements ChannelAdapter {
  private readonly prompt: string
  private readonly colorize: boolean
  private readonly input: NodeJS.ReadableStream
  private readonly output: NodeJS.WritableStream
  private readonly sourceLabel: string
  private readonly contentPrefix?: string
  private readonly contentSuffix?: string

  /** Buffered inbound messages typed by the user but not yet returned. */
  private readonly inboundQueue: Message[] = []

  /** Deferred resolver for the next line of input. */
  private lineResolver: ((line: string) => void) | null = null

  /** readline interface — recreated each time stdin is opened. */
  private rl: readline.Interface | null = null

  /** True once connect() has been called. */
  private _connected = false

  /** EOF sentinel so we can detect stdin close and stop gracefully. */
  private eofSeen = false

  constructor(config: ConsoleAdapterConfig = {}) {
    this.prompt = config.prompt ?? '🦆 > '
    this.colorize = config.colorize ?? true
    this.input = config.inputStream ?? process.stdin
    this.output = config.outputStream ?? process.stdout
    this.sourceLabel = config.sourceLabel ?? 'console'
    this.contentPrefix = config.contentPrefix
    this.contentSuffix = config.contentSuffix
  }

  getChannelName(): string {
    return 'console'
  }

  isConnected(): boolean {
    return this._connected
  }

  /**
   * Sets up readline and prints a welcome banner.
   * Idempotent — safe to call if already connected.
   */
  async connect(): Promise<void> {
    if (this._connected) return

    // Ensure TTY so readline works correctly.
    if (!this.input.isTTY) {
      // In non-TTY (e.g., piped input), push lines directly from the stream.
      this._connected = true
      return
    }

    // Create a readline interface backed by stdin/stdout.
    this.rl = readline.createInterface({
      input: this.input,
      output: this.output,
      prompt: this.prompt,
      completer: (line: string) => {
        // Simple completions for common commands.
        const hits = [
          'exit', 'quit', 'help', 'status', 'reset',
          'clear', 'debug', 'model', 'session',
        ].filter(cmd => cmd.startsWith(line.toLowerCase()))
        return [hits.length > 0 ? hits : [], line]
      },
    })

    // When the user hits Ctrl+C, treat it as a no-op and let them continue.
    this.rl.on('SIGINT', () => {
      this.output.write(`${DIM}(Ctrl+C — type 'exit' to quit)${RESET}\n`)
      this.rl?.prompt()
    })

    // When stdin is closed (e.g., terminal exited), stop the adapter.
    this.rl.on('close', () => {
      this.eofSeen = true
      this._connected = false
      this.lineResolver?.('')
      this.lineResolver = null
    })

    this.printBanner()
    this._connected = true
  }

  /**
   * Prints the agent's reply to stdout.
   * @param text  The agent's response text to display.
   */
  async sendMessage(text: string): Promise<void> {
    const colored = this.colorize
      ? `${CYAN}${BOLD}🦆 Agent:${RESET}\n${indentText(text, 2)}`
      : `🦆 Agent:\n${indentText(text, 2)}`
    this.output.write(colored + '\n')
    if (this.rl) this.rl.prompt()
  }

  /**
   * Reads the next line of input from the user.
   * Returns null if stdin has been closed or prompt is set to '' (non-interactive mode).
   */
  async receiveMessage(): Promise<Message | null> {
    // Serve from the queue first.
    if (this.inboundQueue.length > 0) {
      return this.inboundQueue.shift()!
    }

    // Non-interactive mode: return null immediately.
    if (!this.prompt || !this.rl || !this._connected) {
      return null
    }

    // If stdin was closed, don't try to read further.
    if (this.eofSeen) {
      return null
    }

    // Await the next line from readline.
    const line = await this.readLine()
    const trimmed = line.trim()

    // Empty lines are skipped.
    if (!trimmed) {
      return null
    }

    // Handle built-in console commands.
    const builtIn = this.handleBuiltIn(trimmed)
    if (builtIn !== null) {
      return builtIn
    }

    const content = [this.contentPrefix ?? '', trimmed, this.contentSuffix ?? ''].join('')
    return normalizeMessage(content, 'user', {
      from: this.sourceLabel,
      color: '#28a745', // green — console
    })
  }

  async disconnect(): Promise<void> {
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }
    this._connected = false
    this.lineResolver?.('')
    this.lineResolver = null
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private printBanner(): void {
    if (!this.colorize) {
      this.output.write('DuckHive Console — local channel adapter\n')
      this.output.write('Type your message and press Enter. "help" for commands.\n\n')
      return
    }
    this.output.write(
      `${CYAN}${BOLD}` +
      '╔══════════════════════════════════════╗\n' +
      '║   DuckHive Console Adapter           ║\n' +
      '║   Local REPL channel for DuckHive    ║\n' +
      '╚══════════════════════════════════════╝\n' +
      `${RESET}` +
      `${DIM}Type your message and press Enter. "help" for commands.${RESET}\n\n`,
    )
  }

  /**
   * Prompts the user with readline and waits for the next line.
   * Uses a deferred Promise pattern so this can be called in a loop.
   */
  private readLine(): Promise<string> {
    return new Promise<string>(resolve => {
      this.lineResolver = resolve
      this.rl?.question(this.prompt, (answer: string) => {
        this.lineResolver = null
        resolve(answer)
      })
    })
  }

  /**
   * Handle built-in console commands that don't go to the agent.
   * Returns a Message for internal commands (e.g., 'exit' becomes a quit sentinel).
   * Returns null to pass the input to the agent as a normal message.
   */
  private handleBuiltIn(input: string): Message | null {
    const cmd = input.toLowerCase().trim()

    if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
      this.output.write(
        this.colorize ? `${YELLOW}Goodbye!${RESET}\n` : 'Goodbye!\n',
      )
      this.disconnect()
      // Return null so the agent loop exits.
      return null
    }

    if (cmd === 'help' || cmd === '?') {
      this.output.write(
        this.colorize
          ? `${DIM}` +
            'Commands:\n' +
            '  help, ?    — Show this help\n' +
            '  exit, quit — Disconnect and exit\n' +
            '  clear      — Clear the screen\n' +
            '  status     — Show connection status\n' +
            '  model <id> — Switch model (stub for future use)\n' +
            `${RESET}`
          : 'Commands:\n' +
            '  help, ?    — Show this help\n' +
            '  exit, quit — Disconnect and exit\n' +
            '  clear      — Clear the screen\n' +
            '  status     — Show connection status\n' +
            '  model <id> — Switch model (stub)\n',
      )
      if (this.rl) this.rl.prompt()
      return null // Help was printed — wait for next input.
    }

    if (cmd === 'status') {
      const status = this.colorize
        ? `${GREEN}✅ Connected${RESET} — channel: ${this.getChannelName()}`
        : `✅ Connected — channel: ${this.getChannelName()}`
      this.output.write(status + '\n')
      if (this.rl) this.rl.prompt()
      return null
    }

    if (cmd === 'clear') {
      // VT100 escape: clear screen + go to top-left.
      this.output.write('\x1b[2J\x1b[H')
      if (this.rl) this.rl.prompt()
      return null
    }

    // Unknown command — pass through to the agent.
    return null
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

/** Indent every line of text by `spaces` spaces. */
function indentText(text: string, spaces: number): string {
  const indent = ' '.repeat(spaces)
  return text
    .split('\n')
    .map(line => indent + line)
    .join('\n')
}
