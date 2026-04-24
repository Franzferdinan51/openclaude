/**
 * /connect command implementation
 * Allows connecting external services like Telegram
 */
import type { LocalCommandCall } from '../../types/command.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import type { SecureStorageData } from '../../utils/secureStorage/index.js'

interface TelegramConnectionConfig {
  botToken?: string
  connectedAt?: number
  chatId?: string
}

function getTelegramConfig(storage: SecureStorageData): TelegramConnectionConfig {
  return storage.pluginSecrets?.telegram ?? {}
}

function saveTelegramConfig(storage: SecureStorageData, config: TelegramConnectionConfig): void {
  if (!storage.pluginSecrets) {
    storage.pluginSecrets = {}
  }
  storage.pluginSecrets.telegram = config
}

function formatStatus(config: TelegramConnectionConfig): string {
  const lines: string[] = []
  lines.push('')
  lines.push('📱 Telegram Connection Status')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (config.botToken) {
    lines.push('Status:   ✅ Connected')
    if (config.connectedAt) {
      const date = new Date(config.connectedAt)
      lines.push(`Since:    ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`)
    }
    // Partial token for display
    const partialToken = config.botToken.substring(0, 8) + '...' + config.botToken.slice(-4)
    lines.push(`Token:    ${partialToken}`)
  } else {
    lines.push('Status:   ⚪ Not connected')
  }

  lines.push('')
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const storage = getSecureStorage()
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

  // --status flag: show connection status
  if (flags.status !== undefined) {
    const data = storage.read()
    const config = data ? getTelegramConfig(data) : {}
    return { type: 'text', value: formatStatus(config) }
  }

  // --disconnect flag: remove Telegram configuration
  if (flags.disconnect !== undefined) {
    const data = storage.read()
    if (data?.pluginSecrets?.telegram) {
      delete data.pluginSecrets.telegram
      storage.update(data)
    }
    return {
      type: 'text',
      value: '🔌 Telegram disconnected. Your bot token has been removed.',
    }
  }

  // No arguments: show instructions and prompt for token
  if (positional.length === 0 && Object.keys(flags).length === 0) {
    return {
      type: 'text',
      value: `📱 Connect Telegram to DuckHive

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To connect Telegram, you need a bot token from @BotFather:

1. Open Telegram and search for @BotFather
2. Send /newbot command
3. Follow the prompts to name your bot
4. Copy the token it gives you (looks like: 123456789:ABCdefGhIJKlmNoPQRstuVWxyZ)

Once you have your token, run:
  /connect <your-bot-token>

After connecting, you can use these commands:
  /connect --status   Show connection status
  /connect --disconnect   Remove Telegram connection

Your bot token is stored securely in your system's keychain/credentials store.`,
    }
  }

  // Token provided
  const token = positional.join(' ').trim()

  if (!token) {
    return {
      type: 'text',
      value: '❌ No bot token provided. Run /connect to see instructions.',
    }
  }

  // Basic validation: Telegram bot tokens are like "123456789:ABCdefGhIJKlmNoPQRstuVWxyZ"
  const tokenPattern = /^\d{8,10}:[\w-]{30,}$/
  if (!tokenPattern.test(token)) {
    return {
      type: 'text',
      value: `❌ Invalid bot token format.

Telegram bot tokens look like: 123456789:ABCdefGhIJKlmNoPQRstuVWxyZ

Make sure you copied the complete token from @BotFather.`,
    }
  }

  // Save the token
  let data = storage.read()
  if (!data) {
    data = {}
  }

  const currentConfig = getTelegramConfig(data)
  saveTelegramConfig(data, {
    ...currentConfig,
    botToken: token,
    connectedAt: Date.now(),
  })

  storage.update(data)

  // Also store in environment for the Telegram service to use
  process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN = token

  // Restart Telegram service with the new token (reconnect if was already running)
  // Import dynamically to avoid circular deps
  import('../../services/telegram/index.js').then(({ stopTelegramService, startTelegramService }) => {
    stopTelegramService().catch(() => {})
    setTimeout(() => { startTelegramService().catch(() => {}) }, 500)
  }).catch(() => {})

  return {
    type: 'text',
    value: `✅ Telegram connected successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your bot is now connected. To complete setup:

1. Open Telegram and find your bot (by the name you gave it in @BotFather)
2. Send /start to your bot
3. Your chat ID will be registered automatically

You can now interact with DuckHive through Telegram!

Run /connect --status to see connection details
Run /connect --disconnect to remove the connection`,
  }
}
