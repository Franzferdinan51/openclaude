/**
 * ConsoleAdapter.ts - Local TUI/REPL channel adapter for DuckHive.
 *
 * Provides a local readline-based REPL as a channel for debugging and
 * local development. Messages typed in the terminal are injected into
 * the agent loop; agent replies are printed to stdout.
 *
 * Inbound: user types in terminal -> receiveMessage() -> Message
 * Outbound: agent reply -> sendMessage() -> printed to stdout
 *
 * The adapter stays dependency-free so it works over SSH, in simple Windows
 * terminals, and in headless test environments.
 */

import * as readline from 'readline'
import type {
  ChannelAdapter,
  ChannelAdapterConfig,
} from './ChannelAdapter.js'
import { normalizeMessage } from './ChannelAdapter.js'
import type { Message } from '../utils/mailbox.js'

export interface ConsoleAdapterConfig extends ChannelAdapterConfig {
  /**
   * Prompt string shown to the user. Defaults to 'duckhive> '.
   * Set to '' for non-interactive use, such as tests.
   */
  prompt?: string
  /**
   * When true, color codes the agent replies and system messages.
   * Defaults to true.
   */
  colorize?: boolean
  /** Input stream. Defaults to process.stdin. */
  inputStream?: NodeJS.ReadableStream
  /** Output stream. Defaults to process.stdout. */
  outputStream?: NodeJS.WritableStream
  /** Human-readable label shown in message metadata. */
  sourceLabel?: string
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'

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

  /** readline interface, recreated each time stdin is opened. */
  private rl: readline.Interface | null = null

  /** True once connect() has been called. */
  private _connected = false

  /** EOF sentinel so we can detect stdin close and stop gracefully. */
  private eofSeen = false

  constructor(config: ConsoleAdapterConfig = {}) {
    this.prompt = config.prompt ?? 'duckhive> '
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
   * Idempotent: safe to call if already connected.
   */
  async connect(): Promise<void> {
    if (this._connected) return

    if (!(this.input as NodeJS.ReadStream).isTTY) {
      this._connected = true
      return
    }

    this.rl = readline.createInterface({
      input: this.input,
      output: this.output,
      prompt: this.prompt,
      completer: (line: string) => {
        const hits = [
          'exit', 'quit', 'help', 'status', 'reset',
          'clear', 'debug', 'model', 'session',
        ].filter(cmd => cmd.startsWith(line.toLowerCase()))
        return [hits.length > 0 ? hits : [], line]
      },
    })

    this.rl.on('SIGINT', () => {
      this.output.write(`${DIM}(Ctrl+C - type 'exit' to quit)${RESET}\n`)
      this.rl?.prompt()
    })

    this.rl.on('close', () => {
      this.eofSeen = true
      this._connected = false
      this.lineResolver?.('')
      this.lineResolver = null
    })

    this.printBanner()
    this._connected = true
  }

  /** Prints the agent reply to stdout. */
  async sendMessage(text: string): Promise<void> {
    const colored = this.colorize
      ? `${CYAN}${BOLD}DuckHive Agent:${RESET}\n${indentText(text, 2)}`
      : `DuckHive Agent:\n${indentText(text, 2)}`
    this.output.write(colored + '\n')
    if (this.rl) this.rl.prompt()
  }

  /**
   * Reads the next line of input from the user.
   * Returns null if stdin has closed or prompt is set to ''.
   */
  async receiveMessage(): Promise<Message | null> {
    if (this.inboundQueue.length > 0) {
      return this.inboundQueue.shift()!
    }

    if (!this.prompt || !this.rl || !this._connected) {
      return null
    }

    if (this.eofSeen) {
      return null
    }

    const line = await this.readLine()
    const trimmed = line.trim()

    if (!trimmed) {
      return null
    }

    const builtIn = this.handleBuiltIn(trimmed)
    if (builtIn !== null) {
      return builtIn
    }

    const content = [this.contentPrefix ?? '', trimmed, this.contentSuffix ?? ''].join('')
    return normalizeMessage(content, 'user', {
      from: this.sourceLabel,
      color: '#28a745',
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

  private printBanner(): void {
    if (!this.colorize) {
      this.output.write('DuckHive Console - local channel adapter\n')
      this.output.write('Type your message and press Enter. "help" for commands.\n\n')
      return
    }

    this.output.write(
      `${CYAN}${BOLD}` +
      '========================================\n' +
      'DuckHive Console Adapter\n' +
      'Local REPL channel for DuckHive\n' +
      '========================================\n' +
      `${RESET}` +
      `${DIM}Type your message and press Enter. "help" for commands.${RESET}\n\n`,
    )
  }

  private readLine(): Promise<string> {
    return new Promise<string>(resolve => {
      this.lineResolver = resolve
      this.rl?.question(this.prompt, (answer: string) => {
        this.lineResolver = null
        resolve(answer)
      })
    })
  }

  private handleBuiltIn(input: string): Message | null {
    const cmd = input.toLowerCase().trim()

    if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
      this.output.write(
        this.colorize ? `${YELLOW}Goodbye!${RESET}\n` : 'Goodbye!\n',
      )
      this.disconnect()
      return null
    }

    if (cmd === 'help' || cmd === '?') {
      this.output.write(
        this.colorize
          ? `${DIM}` +
            'Commands:\n' +
            '  help, ?    - Show this help\n' +
            '  exit, quit - Disconnect and exit\n' +
            '  clear      - Clear the screen\n' +
            '  status     - Show connection status\n' +
            '  model <id> - Forward /model <id> to DuckHive\n' +
            `${RESET}`
          : 'Commands:\n' +
            '  help, ?    - Show this help\n' +
            '  exit, quit - Disconnect and exit\n' +
            '  clear      - Clear the screen\n' +
            '  status     - Show connection status\n' +
            '  model <id> - Forward /model <id> to DuckHive\n',
      )
      if (this.rl) this.rl.prompt()
      return null
    }

    if (cmd === 'status') {
      const status = this.colorize
        ? `${GREEN}Connected${RESET} - channel: ${this.getChannelName()}`
        : `Connected - channel: ${this.getChannelName()}`
      this.output.write(status + '\n')
      if (this.rl) this.rl.prompt()
      return null
    }

    if (cmd === 'clear') {
      this.output.write('\x1b[2J\x1b[H')
      if (this.rl) this.rl.prompt()
      return null
    }

    if (cmd.startsWith('model ')) {
      const modelId = input.slice(input.indexOf(' ') + 1).trim()
      if (!modelId) {
        this.output.write('Usage: model <id>\n')
        if (this.rl) this.rl.prompt()
        return null
      }
      return normalizeMessage(`/model ${modelId}`, 'user', {
        from: this.sourceLabel,
        color: '#28a745',
      })
    }

    return null
  }
}

function indentText(text: string, spaces: number): string {
  const indent = ' '.repeat(spaces)
  return text
    .split('\n')
    .map(line => indent + line)
    .join('\n')
}
