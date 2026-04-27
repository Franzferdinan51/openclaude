/**
 * DuckHive Channel Adapter Layer
 *
 * Provides a unified interface for injecting user messages from any channel
 * (Telegram, Email, Webhook, Console REPL) into the DuckHive agent loop.
 * The agent loop doesn't know which channel it's talking to — same loop, any channel.
 *
 * Each adapter normalizes its channel-specific protocol into DuckHive's
 * Message type and back out again via sendMessage().
 *
 * Usage:
 *   import { TelegramAdapter, WebhookAdapter, EmailAdapter, ConsoleAdapter, createAgentLoop } from './channels/index.js'
 *
 *   const channel = new TelegramAdapter({ botToken: process.env.TELEGRAM_BOT_TOKEN })
 *   await channel.connect()
 *   await runAgentWithChannel(agent, channel)
 *
 *   // Agent loop (pseudo-code):
 *   while (true) {
 *     const msg = await channel.receiveMessage()
 *     if (!msg) { await sleep(100); continue }
 *     const reply = await agent.process(msg)
 *     await channel.sendMessage(reply)
 *   }
 */

// Re-export the base interface and utilities.
export {
  type ChannelAdapter,
  type ChannelAdapterConfig,
  normalizeMessage,
} from './ChannelAdapter.js'

export type { Message } from '../utils/mailbox.js'
export type { MessageSource } from '../utils/mailbox.js'

// ─── Adapters ────────────────────────────────────────────────────────────────

export { TelegramAdapter } from './TelegramAdapter.js'
export type { TelegramAdapterConfig } from './TelegramAdapter.js'

export { WebhookAdapter } from './WebhookAdapter.js'
export type { WebhookAdapterConfig } from './WebhookAdapter.js'

export { EmailAdapter } from './EmailAdapter.js'
export type { EmailAdapterConfig } from './EmailAdapter.js'

export { ConsoleAdapter } from './ConsoleAdapter.js'
export type { ConsoleAdapterConfig } from './ConsoleAdapter.js'

// ─── Adapter factory ────────────────────────────────────────────────────────

/**
 * Build the appropriate channel adapter from a config object.
 * Matches on the `type` field:
 *   { type: 'telegram', ... }  → TelegramAdapter
 *   { type: 'webhook', ... }   → WebhookAdapter
 *   { type: 'email', ... }     → EmailAdapter
 *   { type: 'console', ... }    → ConsoleAdapter
 *
 * Unknown types throw.
 */
export function createChannelAdapter(
  config: ChannelAdapterConfig & { type: string },
): ChannelAdapter {
  switch (config.type) {
    case 'telegram':
      return new TelegramAdapter(config)
    case 'webhook':
      return new WebhookAdapter(config)
    case 'email':
      return new EmailAdapter(config)
    case 'console':
      return new ConsoleAdapter(config)
    default:
      throw new Error(
        `[ChannelAdapter] Unknown adapter type: "${config.type}". ` +
          'Supported types: telegram, webhook, email, console.',
      )
  }
}

// ─── Agent loop integration helpers ─────────────────────────────────────────

/**
 * Run the agent loop with a single channel adapter.
 *
 * Calls adapter.connect() before entering the loop.
 * Calls adapter.disconnect() on exit (including on interrupt).
 *
 * @param adapter       The channel adapter to use.
 * @param agent         An async function that receives a Message and returns a reply string.
 * @param pollInterval  How long to sleep when receiveMessage() returns null (ms).
 *
 * @example
 *   const channel = new ConsoleAdapter()
 *   await runAgentWithChannel(channel, async (msg) => {
 *     return await duckHive.processMessage(msg.content)
 *   })
 */
export async function runAgentWithChannel(
  adapter: ChannelAdapter,
  agent: (msg: Message) => Promise<string>,
  pollInterval = 100,
): Promise<void> {
  // Set up clean shutdown.
  const stop = new AbortController()
  const stopSignal = stop.signal

  process.on('SIGINT', () => {
    stop.abort()
  })

  try {
    // Establish the channel connection.
    await adapter.connect()

    console.log(`[DuckHive] Agent loop started — channel: ${adapter.getChannelName()}`)

    // Main loop.
    while (!stopSignal.aborted) {
      // Poll for inbound message.
      let msg: Message | null = null
      try {
        msg = await Promise.race([
          adapter.receiveMessage(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), pollInterval)),
        ])
      } catch (err) {
        console.error('[DuckHive] receiveMessage error:', err)
        await sleep(pollInterval)
        continue
      }

      if (!msg) {
        // No message — yield to the event loop and check again.
        await sleep(pollInterval)
        continue
      }

      // Process the message through the agent.
      try {
        const reply = await agent(msg)
        if (reply) {
          await adapter.sendMessage(reply)
        }
      } catch (err) {
        console.error('[DuckHive] Agent error:', err)
        await adapter.sendMessage(
          `Sorry, I ran into an error processing that: ${String(err)}`,
        )
      }
    }
  } finally {
    await adapter.disconnect()
    console.log(`[DuckHive] Agent loop stopped — channel: ${adapter.getChannelName()}`)
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
