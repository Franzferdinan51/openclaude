/**
 * WebhookAdapter.ts — HTTP webhook receiver channel adapter for DuckHive
 *
 * Spins up a lightweight HTTP server that receives inbound webhook calls
 * (from GitHub, Stripe, IFTTT, Home Assistant, custom scripts, etc.)
 * and normalizes them into DuckHive's Message type.
 *
 * Inbound:  external service → POST /webhook → receiveMessage() → Message
 * Outbound: sendMessage() → user-defined callback or POST to configured URL
 *
 * The server listens on a configurable host:port and verifies each request
 * against an optional HMAC secret before accepting the payload.
 *
 * Example usage:
 *   const adapter = new WebhookAdapter({ port: 3848, path: '/webhook' })
 *   await adapter.connect()
 *   // Adapter is now ready to receive webhook POSTs
 */

import type {
  ChannelAdapter,
  ChannelAdapterConfig,
} from './ChannelAdapter.js'
import { normalizeMessage } from './ChannelAdapter.js'
import type { Message } from '../utils/mailbox.js'

// ─── Config ─────────────────────────────────────────────────────────────────

export interface WebhookAdapterConfig extends ChannelAdapterConfig {
  /** TCP port to listen on. Defaults to 3848. */
  port?: number
  /** Host to bind to. Defaults to '127.0.0.1' (localhost). */
  host?: string
  /**
   * URL path that triggers message ingestion.
   * Defaults to '/webhook'.
   */
  path?: string
  /**
   * HMAC-SHA256 secret used to verify request authenticity.
   * When provided, each request must carry a matching
   * `X-Webhook-Secret: <hex>` header.
   * The raw request body is signed.
   */
  secret?: string
  /**
   * Optional outbound webhook URL. When set, sendMessage() POSTs the text
   * as JSON `{ "text": "..." }` to this URL.
   */
  outboundUrl?: string
  /**
   * Optional headers to include in outbound POST requests (e.g., Authorization).
   */
  outboundHeaders?: Record<string, string>
  /**
   * Maximum request body size in bytes. Defaults to 1 MB.
   */
  maxBodyBytes?: number
  /**
   * HTTP status code to return for verified requests. Defaults to 200.
   * Set to 204 to suppress body response for services that expect no body.
   */
  successStatusCode?: number
  /**
   * Human-readable label used as the Message.from field on inbound messages.
   * Defaults to 'webhook'.
   */
  sourceLabel?: string
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class WebhookAdapter implements ChannelAdapter {
  private readonly port: number
  private readonly host: string
  private readonly webhookPath: string
  private readonly secret?: string
  private readonly outboundUrl?: string
  private readonly outboundHeaders?: Record<string, string>
  private readonly maxBodyBytes: number
  private readonly successStatusCode: number
  private readonly sourceLabel: string
  private readonly contentPrefix?: string
  private readonly contentSuffix?: string

  /** Message queue for received webhooks. */
  private readonly queue: Message[] = []

  /** Underlying HTTP server instance. */
  private server: ReturnType<typeof import('http').createServer> | null = null

  /** True once the HTTP server is listening. */
  private _connected = false

  /** Deferred connect error (e.g., port already in use). */
  private connectError: Error | null = null

  constructor(config: WebhookAdapterConfig = {}) {
    this.port = config.port ?? 3848
    this.host = config.host ?? '127.0.0.1'
    this.webhookPath = config.path ?? '/webhook'
    this.secret = config.secret
    this.outboundUrl = config.outboundUrl
    this.outboundHeaders = config.outboundHeaders
    this.maxBodyBytes = config.maxBodyBytes ?? 1_048_576
    this.successStatusCode = config.successStatusCode ?? 200
    this.sourceLabel = config.sourceLabel ?? 'webhook'
    this.contentPrefix = config.contentPrefix
    this.contentSuffix = config.contentSuffix
  }

  getChannelName(): string {
    return `webhook://${this.host}:${this.port}${this.webhookPath}`
  }

  isConnected(): boolean {
    return this._connected
  }

  /**
   * Starts the HTTP server and begins listening for webhook requests.
   * Idempotent — safe to call if already connected.
   */
  async connect(): Promise<void> {
    if (this._connected) return
    if (this.connectError) throw this.connectError

    return new Promise((resolve, reject) => {
      const http = await import('http')

      this.server = http.createServer((req, res) => {
        void this.handleRequest(req, res)
      })

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        // Only surface the first connection error.
        if (!this._connected && !this.connectError) {
          this.connectError =
            err.code === 'EADDRINUSE'
              ? new Error(`[WebhookAdapter] Port ${this.port} is already in use.`)
              : new Error(`[WebhookAdapter] Server error: ${err.message}`)
          reject(this.connectError)
        }
      })

      this.server.listen(this.port, this.host, () => {
        this._connected = true
        resolve()
      })
    })
  }

  /**
   * Send a payload to the configured outboundUrl.
   * @param text  Text content to send as `{ "text": "<text>" }`
   */
  async sendMessage(text: string): Promise<void> {
    if (!this.outboundUrl) {
      throw new Error(
        '[WebhookAdapter] sendMessage requires outboundUrl to be configured.',
      )
    }
    const body = JSON.stringify({ text })
    const res = await fetch(this.outboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
        ...this.outboundHeaders,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      throw new Error(
        `[WebhookAdapter] Outbound webhook failed: HTTP ${res.status} ${res.statusText}`,
      )
    }
  }

  /**
   * Returns the next queued webhook payload as a Message, or null if the queue is empty.
   */
  async receiveMessage(): Promise<Message | null> {
    return this.queue.shift() ?? null
  }

  /**
   * Stops the HTTP server and releases the port.
   */
  async disconnect(): Promise<void> {
    if (!this.server) return
    return new Promise(resolve => {
      this.server!.close(() => resolve())
      this.server = null
      this._connected = false
    })
  }

  // ─── HTTP handler ──────────────────────────────────────────────────────────

  private async handleRequest(
    req: import('http').IncomingMessage,
    res: import('http').ServerResponse,
  ): Promise<void> {
    // Only handle POST to the configured path.
    if (
      req.method !== 'POST' ||
      (req.url !== this.webhookPath && req.url !== this.webhookPath + '/')
    ) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    // Read the raw body.
    const chunks: Buffer[] = []
    let bodyBytes = 0

    for await (const chunk of req) {
      if (typeof chunk === 'string') {
        bodyBytes += Buffer.byteLength(chunk)
      } else {
        bodyBytes += chunk.length
      }
      if (bodyBytes > this.maxBodyBytes) {
        res.writeHead(413, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Payload too large' }))
        return
      }
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }

    const rawBody = Buffer.concat(chunks).toString('utf8')

    // HMAC verification.
    if (this.secret) {
      const provided = req.headers['x-webhook-secret'] as string | undefined
      if (!provided) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing X-Webhook-Secret header' }))
        return
      }
      const { createHmac } = await import('crypto')
      const expected = createHmac('sha256', this.secret)
        .update(rawBody)
        .digest('hex')
      if (!timingSafeEqual(provided, expected)) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid secret' }))
        return
      }
    }

    // Try to extract text from the payload. Supports plain strings and JSON objects.
    let text: string
    try {
      const parsed = JSON.parse(rawBody)
      // Common field names for webhook text content.
      text =
        parsed.text ??
        parsed.message ??
        parsed.body ??
        parsed.content ??
        parsed.payload ??
        JSON.stringify(parsed)
    } catch {
      // Not JSON — treat as a plain text payload.
      text = rawBody.trim()
    }

    if (!text) {
      res.writeHead(this.successStatusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', skipped: 'empty body' }))
      return
    }

    // Enqueue the message for receiveMessage() to pick up.
    const content = [this.contentPrefix ?? '', text, this.contentSuffix ?? ''].join('')
    this.queue.push(
      normalizeMessage(content, 'user', {
        from: this.sourceLabel,
        color: '#6f42c1', // purple — webhook color
      }),
    )

    res.writeHead(this.successStatusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

/** Timing-safe string comparison to prevent timing attacks on HMAC verification. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
