/**
 * /channel command implementation
 * Manages channel adapters (Telegram, etc.)
 *
 * Usage:
 *   /channel connect telegram --token <token>
 *   /channel disconnect telegram
 *   /channel status
 *   /channel list
 */

import type { LocalCommandCall, LocalJSXCommandContext } from '../../types/command.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import type { SecureStorageData } from '../../utils/secureStorage/index.js'

interface ChannelConnectionConfig {
  telegram?: {
    botToken?: string
    connectedAt?: number
    chatId?: string
    enabled?: boolean
  }
}

function getChannelConfig(storage: SecureStorageData): ChannelConnectionConfig {
  const secrets = storage.pluginSecrets ?? {}
  return {
    telegram: secrets.telegram as ChannelConnectionConfig['telegram'],
  }
}

function saveChannelConfig(data: SecureStorageData, config: ChannelConnectionConfig): void {
  data.pluginSecrets = {
    ...data.pluginSecrets,
    telegram: {
      botToken: config.telegram?.botToken,
      connectedAt: config.telegram?.connectedAt,
      enabled: config.telegram?.enabled,
    } as unknown as Record<string, string>,
  }
}

function formatChannelStatus(config: ChannelConnectionConfig): string {
  const lines: string[] = []
  lines.push('')
  lines.push('📡 Channel Adapter Status')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const tg = config.telegram
  if (tg?.botToken) {
    const partialToken = tg.botToken.substring(0, 8) + '...' + tg.botToken.slice(-4)
    lines.push(`Telegram:  ✅ Connected`)
    lines.push(`           Token: ${partialToken}`)
    if (tg.connectedAt) {
      const date = new Date(tg.connectedAt)
      lines.push(`           Since: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`)
    }
    lines.push(`           Enabled: ${tg.enabled !== false ? 'yes' : 'no'}`)
  } else {
    lines.push('Telegram:  ⚪ Not connected')
  }

  lines.push('')
  lines.push('Available channels: telegram')
  lines.push('')
  return lines.join('\n')
}

function listChannels(): string {
  return `📡 Available Channel Adapters

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

telegram  — Telegram Bot integration
  Commands:
    /channel connect telegram --token <TOKEN>
    /channel disconnect telegram
    /channel status

To connect Telegram:
1. Create a bot via @BotFather in Telegram
2. Copy the bot token
3. Run: /channel connect telegram --token <your-token>
`
}

export const call: LocalCommandCall = async (
  _args: string,
  _context: LocalJSXCommandContext,
) => {
  const storage = getSecureStorage()
  const data = storage.read() ?? {}
  const args = _args
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (const arg of parsedArgs) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      flags[k] = v ?? true
    } else {
      positional.push(arg)
    }
  }

  const [action, channelType] = positional

  // /channel list — show available channels
  if (action === 'list' || (!action && Object.keys(flags).length === 0)) {
    return { type: 'text', value: listChannels() }
  }

  // /channel status — show connection status for all channels
  if (action === 'status') {
    return { type: 'text', value: formatChannelStatus(getChannelConfig(data)) }
  }

  // /channel connect telegram --token <token>
  if (action === 'connect' && channelType === 'telegram') {
    const token = typeof flags.token === 'string' ? flags.token : positional.slice(2).join(' ').trim()

    if (!token) {
      return {
        type: 'text',
        value: `❌ No bot token provided.

To connect Telegram:
  /channel connect telegram --token <your-bot-token>

Get a token from @BotFather in Telegram.`,
      }
    }

    // Validate token format
    const tokenPattern = /^\d{8,10}:[\w-]{20,}$/
    if (!tokenPattern.test(token)) {
      return {
        type: 'text',
        value: `❌ Invalid bot token format.

Telegram bot tokens look like: 123456789:ABCdefGhIJKlmNoPQRstuVWxyZ`,
      }
    }

    const config = getChannelConfig(data)
    saveChannelConfig(data, {
      ...config,
      telegram: {
        ...config.telegram,
        botToken: token,
        connectedAt: Date.now(),
        enabled: true,
      },
    })
    storage.update(data)

    // Set env var for the service
    process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = token

    // Restart Telegram service
    import('../../services/telegram/index.js').then(({ stopTelegramService, startTelegramService }) => {
      void stopTelegramService()
      setTimeout(() => { void startTelegramService() }, 500)
    }).catch(() => {})

    return {
      type: 'text',
      value: `✅ Telegram channel connected!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Send /start to your bot in Telegram to register your chat.

Run /channel status to see connection details
Run /channel disconnect telegram to remove`,
    }
  }

  // /channel disconnect telegram
  if (action === 'disconnect' && channelType === 'telegram') {
    const config = getChannelConfig(data)
    if (config.telegram) {
      delete config.telegram
      saveChannelConfig(data, config)
      storage.update(data)
    }

    // Stop the service
    import('../../services/telegram/index.js').then(({ stopTelegramService }) => {
      void stopTelegramService()
    }).catch(() => {})

    return {
      type: 'text',
      value: '🔌 Telegram channel disconnected.',
    }
  }

  // /channel disconnect (general)
  if (action === 'disconnect') {
    return {
      type: 'text',
      value: `Usage: /channel disconnect <channel-type>

Available: telegram`,
    }
  }

  // Default: show help
  return { type: 'text', value: listChannels() }
}