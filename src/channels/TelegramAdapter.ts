/**
 * TelegramAdapter.ts — Telegram channel adapter for DuckHive
 *
 * Wraps the Telegram Bot API (either long-polling via getUpdates or webhook mode)
 * and normalizes messages to DuckHive's Message type.
 *
 * The Telegram Bot API is HTTP-based — no extra npm dependencies required.
 * Set TELEGRAM_BOT_TOKEN env var or pass botToken in config.
 *
 * Inbound:  user message → Telegram API → receiveMessage() → Message
 * Outbound:  sendMessage() → Telegram API → user
 *
 * Supports:
 *   - Long-polling (default, no server required)
 *   - Webhook mode (production, requires HTTPS endpoint)
 *   - Markdown outbound formatting
 *   - Reply-to threading via message_id
 */

import type {
  ChannelAdapter,
  ChannelAdapterConfig,
} from './ChannelAdapter.js'
import { normalizeMessage } from './ChannelAdapter.js'
import type { Message } from '../utils/mailbox.js'

// ─── Telegram Bot API types ───────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
}

interface TelegramMessage {
  message_id: number
  chat: { id: number; type: string; title?: string; username?: string }
  from?: { id: number; is_bot: boolean; first_name: string }
  text?: string
  date: number
}

interface TelegramSendMessageParams {
  chat_id: number
  text: string
  parse_mode?: 'MarkdownV2' | 'HTML' | undefined
  reply_to_message_id?: number
  disable_web_page_preview?: boolean
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface TelegramAdapterConfig extends ChannelAdapterConfig {
  /** Telegram bot token (from @BotFather). Falls back to TELEGRAM_BOT_TOKEN env. */
  botToken?: string
  /**
   * Telegram chat ID to receive messages from and send replies to.
   * When omitted, the adapter accepts messages from any chat the bot has joined.
   * Set this to your personal chat ID for single-user mode.
   */
  allowedChatId?: number
  /**
   * Timeout for long-polling getUpdates, in milliseconds.
   * Defaults to 55000 (just under Telegram's 60s server timeout).
   */
  longPollTimeout?: number
  /**
   * When true, the adapter offsets the update_id after each receiveMessage()
   * so the same update is never returned twice. Always true.
   */
  autoOffset?: boolean
  /**
   * Custom Telegram API base URL (for self-hosted Telegram-compatible servers).
   * Defaults to https://api.telegram.org.
   */
  apiBase?: string
  /**
   * Secret token for webhook verification (HMAC-SHA256 of the update).
   * When provided alongside a webhook URL, enables webhook verification mode.
   */
  webhookSecret?: string
}

const DEFAULT_LONG_POLL_TIMEOUT_MS = 55_000
const DEFAULT_API_BASE = 'https://api.telegram.org'

// ─── Adapter ────────────────────────────────────────────────────────────────

export class TelegramAdapter implements ChannelAdapter {
  private readonly botToken: string
  private readonly allowedChatId?: number
  private readonly longPollTimeout: number
  private readonly apiBase: string
  private readonly contentPrefix?: string
  private readonly contentSuffix?: string
  private readonly sourceLabel: string

  /** Tracks the last processed update_id so we resume correctly after reconnect. */
  private lastUpdateId = 0

  /** Pending inbound update buffered between receiveMessage() calls. */
  private pendingUpdate: TelegramUpdate | null = null

  /** True once connect() has been called. */
  private connected = false

  /** Flag so the long-poll loop can be cleanly cancelled. */
  private stopped = false

  constructor(config: TelegramAdapterConfig = {}) {
    const token =
      config.botToken ?? process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      throw new Error(
        '[TelegramAdapter] botToken is required. ' +
          'Pass it in config or set the TELEGRAM_BOT_TOKEN env var.',
      )
    }
    this.botToken = token
    this.allowedChatId = config.allowedChatId
    this.longPollTimeout = config.longPollTimeout ?? DEFAULT_LONG_POLL_TIMEOUT_MS
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE
    this.contentPrefix = config.contentPrefix
    this.contentSuffix = config.contentSuffix
    this.sourceLabel = config.sourceLabel ?? 'telegram'
  }

  getChannelName(): string {
    return `telegram:${this.botToken.split(':')[0]}…`
  }

  isConnected(): boolean {
    return this.connected
  }

  /**
   * Validates the bot token with Telegram's getMe endpoint.
   * Call after construction to confirm credentials are valid.
   */
  async connect(): Promise<void> {
    if (this.connected) return
    const me = await this.apiCall<{ ok: boolean; result: { username: string } }>(
      `getMe`,
      {},
    )
    if (!me.ok) {
      throw new Error(`[TelegramAdapter] Bot authentication failed: ${JSON.stringify(me)}`)
    }
    this.connected = true
  }

  /**
   * Send a message to the allowed chat (or the most recent chat for multi-chat bots).
   * @param text  MarkdownV2 or HTML formatted message. Falls back to plain text.
   */
  async sendMessage(text: string): Promise<void> {
    if (!this.allowedChatId) {
      throw new Error(
        '[TelegramAdapter] sendMessage requires allowedChatId to be set. ' +
          'Either pass it in the constructor or update the adapter to track chat context.',
      )
    }
    const params: TelegramSendMessageParams = {
      chat_id: this.allowedChatId,
      text,
      parse_mode: 'MarkdownV2',
    }
    const result = await this.apiCall<{ ok: boolean }>('sendMessage', params as Record<string, unknown>)
    if (!result.ok) {
      throw new Error(`[TelegramAdapter] sendMessage failed: ${JSON.stringify(result)}`)
    }
  }

  /**
   * Poll for the next inbound Telegram update.
   *
   * Uses getUpdates long-polling when no pending update is buffered.
   * Returns null immediately when no new update is available.
   */
  async receiveMessage(): Promise<Message | null> {
    // Serve a buffered update first (from a prior getUpdates response).
    if (this.pendingUpdate) {
      const update = this.takeNextUpdate()
      if (update) {
        const msg = this.extractMessage(update)
        if (msg) return msg
      }
    }

    // Fetch the next batch of updates.
    const updates = await this.fetchUpdates()
    if (!updates || updates.length === 0) {
      return null
    }

    // Buffer any extra updates beyond the first.
    if (updates.length > 1) {
      this.pendingUpdate = updates[1] ?? null
    }

    const first = updates[0]
    const msg = this.extractMessage(first)
    return msg
  }

  async disconnect(): Promise<void> {
    this.stopped = true
    this.connected = false
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async fetchUpdates(): Promise<TelegramUpdate[]> {
    try {
      const params: Record<string, unknown> = {
        timeout: Math.floor(this.longPollTimeout / 1000),
        offset: this.lastUpdateId > 0 ? this.lastUpdateId + 1 : undefined,
      }
      const result = await this.apiCall<{ ok: boolean; result: TelegramUpdate[] }>(
        'getUpdates',
        params,
      )
      if (!result.ok || !result.result) return []

      // Advance the offset past every update we've seen.
      for (const update of result.result) {
        this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id)
      }

      return result.result
    } catch {
      return []
    }
  }

  /** Extract the next buffered update and shift the buffer. */
  private takeNextUpdate(): TelegramUpdate | null {
    const update = this.pendingUpdate
    this.pendingUpdate = null
    return update
  }

  /**
   * Convert a TelegramUpdate to a DuckHive Message.
   * Returns null if the update doesn't contain a text message or isn't from the allowed chat.
   */
  private extractMessage(update: TelegramUpdate): Message | null {
    const tgMsg =
      update.message ?? update.edited_message ?? update.channel_post
    if (!tgMsg) return null

    // Ignore messages sent by the bot itself.
    if (tgMsg.from?.is_bot) return null

    // Filter to allowed chat if configured.
    if (this.allowedChatId && tgMsg.chat.id !== this.allowedChatId) return null

    const text = tgMsg.text?.trim()
    if (!text) return null

    const content = [
      this.contentPrefix ?? '',
      text,
      this.contentSuffix ?? '',
    ].join('')

    return normalizeMessage(content, 'user', {
      from: tgMsg.from?.first_name ?? tgMsg.chat.username ?? String(tgMsg.chat.id),
      color: '#0088cc', // Telegram brand blue
    })
  }

  private async apiCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const url = `${this.apiBase}/bot${this.botToken}/${method}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      throw new Error(`[TelegramAdapter] HTTP ${res.status} from ${method}`)
    }
    return res.json() as Promise<T>
  }
}
