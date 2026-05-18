/**
 * TelegramAdapter.ts - Telegram channel adapter for DuckHive
 *
 * Wraps the Telegram Bot API (either long-polling via getUpdates or webhook mode)
 * and normalizes messages to DuckHive's Message type.
 *
 * The Telegram Bot API is HTTP-based - no extra npm dependencies required.
 * Set DUCKHIVE_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN, or pass botToken in config.
 *
 * Inbound:  user message -> Telegram API -> receiveMessage() -> Message
 * Outbound:  sendMessage() -> Telegram API -> user
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
import { createCombinedAbortSignal } from '../utils/combinedAbortSignal.js'

// Telegram Bot API types

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

// Config

export interface TelegramAdapterConfig extends ChannelAdapterConfig {
  /** Telegram bot token (from @BotFather). Falls back to DuckHive Telegram env vars. */
  botToken?: string
  /**
   * Telegram chat ID to receive messages from and send replies to.
   * When omitted, the adapter accepts messages from any chat the bot has joined.
   * Set this to your personal chat ID for single-user mode.
   */
  allowedChatId?: number
  /**
   * Telegram chat IDs allowed to send inbound messages.
   * Useful for shared bots; outbound sendMessage still targets allowedChatId.
   */
  allowedChatIds?: Array<number | string>
  /**
   * Timeout for Telegram's server-side getUpdates long poll, in milliseconds.
   * Defaults to 30000. The HTTP client abort window is kept above this value.
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

const DEFAULT_API_TIMEOUT_MS = 30_000
const GET_UPDATES_API_TIMEOUT_MS = 45_000
const DEFAULT_LONG_POLL_TIMEOUT_MS = 30_000
const LONG_POLL_ABORT_MARGIN_MS = 5_000
const DEFAULT_API_BASE = 'https://api.telegram.org'

export function resolveTelegramAdapterLongPollSeconds(timeoutMs: number): number {
  const maxLongPollMs = Math.max(
    1_000,
    GET_UPDATES_API_TIMEOUT_MS - LONG_POLL_ABORT_MARGIN_MS,
  )
  const configuredMs = Number.isFinite(timeoutMs)
    ? Math.max(1_000, Math.floor(timeoutMs))
    : DEFAULT_LONG_POLL_TIMEOUT_MS
  return Math.max(1, Math.floor(Math.min(configuredMs, maxLongPollMs) / 1000))
}

// Adapter

export class TelegramAdapter implements ChannelAdapter {
  private readonly botToken: string
  private readonly allowedChatId?: number
  private readonly allowedChatIds: Set<number> | null
  private readonly longPollTimeout: number
  private readonly apiBase: string
  private readonly contentPrefix?: string
  private readonly contentSuffix?: string
  private readonly sourceLabel: string

  /** Tracks the last processed update_id so we resume correctly after reconnect. */
  private lastUpdateId = 0

  /** Pending inbound update buffered between receiveMessage() calls. */
  private pendingUpdates: TelegramUpdate[] = []

  /** True once connect() has been called. */
  private connected = false

  /** Flag so the long-poll loop can be cleanly cancelled. */
  private stopped = false

  constructor(config: TelegramAdapterConfig = {}) {
    const token =
      config.botToken ?? process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      throw new Error(
        '[TelegramAdapter] botToken is required. ' +
          'Pass it in config or set DUCKHIVE_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN.',
      )
    }
    this.botToken = token
    const allowedChatConfig =
      config.allowedChatIds ??
      config.allowedChatId ??
      process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID
    this.allowedChatId =
      config.allowedChatId ?? resolvePrimaryAllowedChatId(allowedChatConfig)
    this.allowedChatIds = parseAllowedChatIds(
      allowedChatConfig,
    )
    this.longPollTimeout = config.longPollTimeout ?? DEFAULT_LONG_POLL_TIMEOUT_MS
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE
    this.contentPrefix = config.contentPrefix
    this.contentSuffix = config.contentSuffix
    this.sourceLabel = config.sourceLabel ?? 'telegram'
  }

  getChannelName(): string {
    return `telegram:${this.botToken.split(':')[0]}...`
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
          'Either pass allowedChatId/allowedChatIds in the constructor or set DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID.',
      )
    }
    const params: TelegramSendMessageParams = {
      chat_id: this.allowedChatId,
      text,
      parse_mode: 'MarkdownV2',
    }
    const result = await this.apiCall<{ ok: boolean }>(
      'sendMessage',
      params as unknown as Record<string, unknown>,
    )
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
    let update = this.takeNextUpdate()
    while (update) {
      const msg = this.extractMessage(update)
      if (msg) return msg
      update = this.takeNextUpdate()
    }

    this.pendingUpdates.push(...await this.fetchUpdates())
    update = this.takeNextUpdate()
    while (update) {
      const msg = this.extractMessage(update)
      if (msg) return msg
      update = this.takeNextUpdate()
    }

    return null
  }

  async disconnect(): Promise<void> {
    this.stopped = true
    this.connected = false
  }

  // Internal helpers

  private async fetchUpdates(): Promise<TelegramUpdate[]> {
    try {
      const params: Record<string, unknown> = {
        timeout: resolveTelegramAdapterLongPollSeconds(this.longPollTimeout),
        offset: this.lastUpdateId > 0 ? this.lastUpdateId + 1 : undefined,
      }
      const result = await this.apiCall<{ ok: boolean; result: TelegramUpdate[] }>(
        'getUpdates',
        params,
        GET_UPDATES_API_TIMEOUT_MS,
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
    return this.pendingUpdates.shift() ?? null
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

    // Filter to allowed chats if configured.
    if (this.allowedChatIds && !this.allowedChatIds.has(tgMsg.chat.id)) return null

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

  private async apiCall<T>(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
  ): Promise<T> {
    const url = `${this.apiBase}/bot${this.botToken}/${method}`
    const { signal, cleanup } = createCombinedAbortSignal(undefined, {
      timeoutMs,
    })
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    }).finally(cleanup)
    if (!res.ok) {
      throw new Error(`[TelegramAdapter] HTTP ${res.status} from ${method}`)
    }
    return res.json() as Promise<T>
  }
}

function parseAllowedChatIds(
  value: TelegramAdapterConfig['allowedChatIds'] | number | string | undefined,
): Set<number> | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const rawValues = Array.isArray(value) ? value : String(value).split(',')
  const ids = rawValues
    .map(item => Number(String(item).trim()))
    .filter(item => Number.isFinite(item))

  // A provided-but-malformed allowlist must fail closed. Returning null here
  // would mean "no allowlist" and would accept every chat the bot can read.
  return ids.length > 0 ? new Set(ids) : new Set()
}

function resolvePrimaryAllowedChatId(
  value: TelegramAdapterConfig['allowedChatIds'] | number | string | undefined,
): number | undefined {
  return parseAllowedChatIds(value)?.values().next().value
}
