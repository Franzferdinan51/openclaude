/**
 * ChannelAdapter.ts — Base interface for all DuckHive channel adapters
 *
 * A ChannelAdapter normalizes inbound/outbound communication for any channel
 * (Telegram, Email, Webhook, Console, etc.) into DuckHive's Message type.
 * The agent loop doesn't know which channel it's talking to — same loop, any channel.
 *
 * All adapters MUST implement:
 *   sendMessage(text: string): Promise<void>   — send outbound message
 *   receiveMessage(): Promise<Message | null>   — poll for inbound (null = no message)
 *   getChannelName(): string                    — human-readable channel identifier
 *   isConnected(): boolean                      — connection health check
 *
 * Optional lifecycle hooks:
 *   connect(): Promise<void>       — establish connection (call once before receiveMessage)
 *   disconnect(): Promise<void>     — clean up resources
 *
 * The agent loop calls receiveMessage() in a loop. When it returns a non-null Message,
 * that message is injected into the conversation as if it came from a user.
 * The agent's reply goes back through sendMessage() on the same adapter.
 */

import type { Message as MessageType } from '../utils/mailbox.js'

export type { MessageSource } from '../utils/mailbox.js'
export type { Message } from '../utils/mailbox.js'

export interface ChannelAdapter {
  /** Human-readable name shown in logs and debugging output. */
  getChannelName(): string

  /** True when the adapter has an active connection to its backend. */
  isConnected(): boolean

  /**
   * Send an outbound message through the channel.
   * Throws on unrecoverable errors; returns normally on transient failures
   * so the caller can retry.
   */
  sendMessage(text: string): Promise<void>

  /**
   * Poll for an inbound message.
   *
   * Returns:
   *   Message  — the next inbound message, normalized to DuckHive's Message type
   *   null     — no message available right now (non-blocking poll)
   *
   * The agent loop calls this repeatedly. Block only when necessary
   * (e.g., HTTP server waiting on a request); return null immediately
   * for all other cases.
   */
  receiveMessage(): Promise<MessageType | null>

  /**
   * Establish the channel connection. Call once after construction,
   * before calling receiveMessage(). Idempotent — safe to call if already connected.
   *
   * Defaults to no-op; override in adapters that need a handshake.
   */
  connect?(): Promise<void>

  /**
   * Tear down the channel connection and release resources.
   * Called during graceful shutdown. Idempotent.
   *
   * Defaults to no-op; override in adapters that hold open connections.
   */
  disconnect?(): Promise<void>
}

/**
 * Configuration shared across all channel adapters.
 */
export interface ChannelAdapterConfig {
  /** Optional prefix prepended to all inbound message content (e.g., "[telegram] "). */
  contentPrefix?: string
  /** Optional suffix appended to all inbound message content. */
  contentSuffix?: string
  /** Optional label used as the Message.from field on inbound messages. */
  sourceLabel?: string
}

/**
 * Build a normalized Message from raw content fields.
 * All channel adapters use this to produce consistent Message objects.
 */
export function normalizeMessage(
  content: string,
  source: MessageType['source'],
  overrides?: Partial<Omit<MessageType, 'id' | 'source' | 'content' | 'timestamp'>>,
): MessageType {
  return {
    id: crypto.randomUUID(),
    source,
    content,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}
