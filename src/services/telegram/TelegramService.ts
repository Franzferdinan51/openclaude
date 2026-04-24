/**
 * Telegram Bot Service
 *
 * Provides bidirectional communication between DuckHive REPL and Telegram.
 * Uses long polling (no webhook required) to receive messages and can send
 * updates back to the user's Telegram chat.
 *
 * Enable with: DUCKHIVE_TELEGRAM_BOT_TOKEN env var or /connect command.
 * Auto-reconnects on failure with exponential backoff.
 * Persists chat_id across restarts so Telegram messages don't get lost.
 */

import { logForDebugging } from '../../utils/debug.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'

// ============================================================================
// Types
// ============================================================================

export interface TelegramMessage {
  update_id: number
  message?: {
    from: { id: number; is_bot: boolean; first_name: string; username?: string }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
}

export interface TelegramUpdate {
  ok: boolean
  result: TelegramMessage[]
}

export type TelegramCommandHandler = (chatId: number, args: string) => void
export type TelegramMessageHandler = (chatId: number, text: string) => void

// ============================================================================
// Telegram Bot API Client
// ============================================================================

class TelegramBotAPI {
  private token: string
  private baseUrl = 'https://api.telegram.org/bot'

  constructor(token: string) {
    this.token = token
  }

  private async request<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${this.token}/${method}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }

  async getMe(): Promise<{ ok: boolean; result: { id: number; is_bot: boolean; username: string } }> {
    return this.request('getMe')
  }

  async getUpdates(offset: number, timeout: number = 30): Promise<TelegramUpdate> {
    return this.request('getUpdates', { offset, timeout, allowed_updates: ['message'] })
  }

  async sendMessage(chatId: number, text: string, parseMode: 'Markdown' | 'HTML' | undefined = undefined): Promise<unknown> {
    return this.request('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    })
  }

  async sendMarkdown(chatId: number, text: string): Promise<unknown> {
    return this.sendMessage(chatId, text, 'Markdown')
  }

  async setCommands(commands: Array<{ command: string; description: string }>): Promise<unknown> {
    return this.request('setMyCommands', { commands })
  }
}

// ============================================================================
// Storage helpers
// ============================================================================

const STORAGE_KEY = 'pluginSecrets.telegram'

function getStorageData(): { botToken?: string; chatId?: number; connectionStatus?: string } | null {
  try {
    const storage = getSecureStorage()
    return storage.read() as { botToken?: string; chatId?: number; connectionStatus?: string } | null
  } catch {
    return null
  }
}

function saveStorageData(data: { botToken?: string; chatId?: number; connectionStatus?: string }): void {
  try {
    const storage = getSecureStorage()
    const existing = storage.read() as Record<string, unknown> ?? {}
    existing.pluginSecrets = existing.pluginSecrets ?? {}
    ;(existing.pluginSecrets as Record<string, unknown>)[STORAGE_KEY.split('.')[1]] = {
      ...((existing.pluginSecrets as Record<string, unknown>)[STORAGE_KEY.split('.')[1]] as Record<string, unknown> | undefined),
      ...data,
    }
    storage.update(existing)
  } catch { /* ignore */ }
}

function getStoredChatId(): number | null {
  return getStorageData()?.chatId ?? null
}

function saveChatId(chatId: number): void {
  saveStorageData({ chatId, connectionStatus: 'connected' })
}

// ============================================================================
// Telegram Service
// ============================================================================

let api: TelegramBotAPI | null = null
let offset = 0
let registeredChatId: number | null = null
let isConnected = false

// Reconnection state
let reconnectAttempts = 0
const MAX_RECONNECT_DELAY = 60000 // 1 minute max
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

const commandHandlers = new Map<string, TelegramCommandHandler>()
const messageHandlers: TelegramMessageHandler[] = []

export function registerCommand(command: string, handler: TelegramCommandHandler): void {
  commandHandlers.set(command, handler)
}

export function onTelegramMessage(handler: TelegramMessageHandler): () => void {
  messageHandlers.push(handler)
  return () => {
    const idx = messageHandlers.indexOf(handler)
    if (idx !== -1) messageHandlers.splice(idx, 1)
  }
}

export function getRegisteredChatId(): number | null {
  return registeredChatId
}

export function isTelegramConnected(): boolean {
  return isConnected
}

function getToken(): string | null {
  const envToken = process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN
  if (envToken) return envToken

  const data = getStorageData()
  return data?.botToken ?? null
}

// ============================================================================
// Polling (non-interval, promise-based with reconnect)
// ============================================================================

let shouldStop = false

async function pollLoop(): Promise<void> {
  if (!api || shouldStop) return

  try {
    const updates = await api.getUpdates(offset, 30)
    if (!updates.ok || updates.result.length === 0) return

    for (const update of updates.result) {
      offset = update.update_id + 1

      if (update.message?.text) {
        const chatId = update.message.chat.id
        const text = update.message.text

        // Persist chatId on first message
        if (!registeredChatId) {
          registeredChatId = chatId
          saveChatId(chatId)
          logForDebugging(`[telegram] registered chat ${chatId}`)
          // Notify REPL that connection is ready
          for (const h of messageHandlers) {
            try { h(chatId, '') } catch { /* noop */ }
          }
        }

        // Handle commands
        if (text.startsWith('/')) {
          const parts = text.slice(1).split(' ')
          const cmd = parts[0].toLowerCase()
          const args = parts.slice(1).join(' ')

          const handler = commandHandlers.get(cmd)
          if (handler) {
            try { handler(chatId, args) }
            catch (err) { api?.sendMessage(chatId, `Error: ${err instanceof Error ? err.message : String(err)}`).catch(() => {}) }
          } else {
            api?.sendMessage(chatId, `Unknown command: /${cmd}. Try /help`).catch(() => {})
          }
        } else {
          for (const h of messageHandlers) {
            try { h(chatId, text) }
            catch (err) { logForDebugging(`[telegram] message handler error: ${err}`) }
          }
          // Also feed non-command messages into the DuckHive REPL command queue
          // so they are processed as user queries.
          queueTelegramMessageForRepl(chatId, text)
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logForDebugging(`[telegram] polling error: ${msg}`)

    // On network errors, schedule reconnect
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
      scheduleReconnect()
    }
  }

  // Continue polling unless stopped
  if (!shouldStop && api) {
    // Use setTimeout to yield to event loop between polls
    await new Promise(resolve => setTimeout(resolve, 0))
    return pollLoop()
  }
}

function scheduleReconnect(): void {
  if (shouldStop) return

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY)
  reconnectAttempts++

  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null
    if (api && !shouldStop) {
      logForDebugging(`[telegram] reconnecting (attempt ${reconnectAttempts}, delay ${delay}ms)...`)
      pollLoop().catch(err => {
        logForDebugging(`[telegram] reconnect poll error: ${err}`)
        scheduleReconnect()
      })
    }
  }, delay)
}

// ============================================================================
// Service lifecycle
// ============================================================================

export async function startTelegramService(): Promise<void> {
  const token = getToken()
  if (!token) {
    logForDebugging('[telegram] no token found, skipping start')
    return
  }

  if (api) {
    logForDebugging('[telegram] already running')
    return
  }

  shouldStop = false
  reconnectAttempts = 0

  try {
    api = new TelegramBotAPI(token)
    const me = await api.getMe()
    logForDebugging(`[telegram] bot username: @${me.result.username}`)

    // Restore chatId from storage
    const storedChatId = getStoredChatId()
    if (storedChatId) {
      registeredChatId = storedChatId
      logForDebugging(`[telegram] restored chat ${storedChatId} from storage`)
    }

    // Set bot commands
    await api.setCommands([
      { command: 'start', description: 'Register with DuckHive' },
      { command: 'status', description: 'Show current session status' },
      { command: 'help', description: 'Show available commands' },
    ])

    isConnected = true
    logForDebugging('[telegram] service started with long polling')

    // Start polling
    pollLoop().catch(err => {
      logForDebugging(`[telegram] pollLoop error: ${err}`)
      scheduleReconnect()
    })
  } catch (err) {
    api = null
    isConnected = false
    logForDebugging(`[telegram] failed to start: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function stopTelegramService(): void {
  shouldStop = true
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  api = null
  offset = 0
  isConnected = false
  // NOTE: registeredChatId is kept in memory — it will be restored from storage on next start
  logForDebugging('[telegram] service stopped (chatId preserved in storage)')
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  // Try in-memory chatId first, then stored
  const chatId = registeredChatId ?? getStoredChatId()
  if (!chatId || !api) {
    logForDebugging('[telegram] cannot send: no registered chat or no API')
    return false
  }
  try {
    await api.sendMarkdown(chatId, text)
    logForDebugging(`[telegram] sent message to ${chatId}`)
    return true
  } catch (err) {
    logForDebugging(`[telegram] send error: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ============================================================================
// REPL Integration - bridge Telegram messages to DuckHive query pipeline
// ============================================================================

// Queue of messages when REPL handler not yet registered
const telegramMessageQueue: Array<{ chatId: number; text: string }> = []
let replMessageHandler: ((text: string) => Promise<void>) | null = null

export function onTelegramReplMessage(handler: (text: string) => Promise<void>): () => void {
  replMessageHandler = handler
  // Drain queued messages
  while (telegramMessageQueue.length > 0) {
    const msg = telegramMessageQueue.shift()
    if (msg && handler) {
      handler(msg.text).catch(err => logForDebugging(`[telegram] queued repl error: ${err}`))
    }
  }
  return () => { replMessageHandler = null }
}

export function queueTelegramMessageForRepl(chatId: number, text: string): void {
  if (replMessageHandler) {
    replMessageHandler(text).catch(err => logForDebugging(`[telegram] queued repl error: ${err}`))
  } else {
    telegramMessageQueue.push({ chatId, text })
    logForDebugging(`[telegram] queued message (${telegramMessageQueue.length} in queue)`)
  }
}

// ============================================================================
// Built-in commands
// ============================================================================

registerCommand('start', (chatId) => {
  registeredChatId = chatId
  saveChatId(chatId)
  api?.sendMarkdown(chatId, '✅ *DuckHive connected!*\n\nSend me a message and I\'ll forward it to your DuckHive session.\n\nUse /help for commands.').catch(() => {})
})

registerCommand('help', (chatId) => {
  api?.sendMarkdown(chatId, `*DuckHive Telegram Commands*

• /start — Register with DuckHive
• /status — Current session status
• /help — Show this help

You can also just send any message to have it processed by DuckHive.`).catch(() => {})
})

registerCommand('status', async (chatId) => {
  const chatIdOk = registeredChatId ?? getStoredChatId()
  api?.sendMarkdown(chatId, `*DuckHive Status*

Session: ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}
Model: ${process.env.DUCKHIVE_MODEL_NAME ?? 'default'}
Provider: ${process.env.DUCKHIVE_PROVIDER ?? 'default'}

Send /help for commands.`).catch(() => {})
})

// ============================================================================
// Auto-start
// ============================================================================

const token = getToken()
if (token) {
  setTimeout(() => { startTelegramService().catch(() => {}) }, 2000)
}