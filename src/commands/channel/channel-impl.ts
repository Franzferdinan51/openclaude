/**
 * /channel command implementation
 *
 * This is a channel-oriented wrapper around the concrete connection flows.
 * Telegram is currently delegated to /connect so there is only one actual
 * code path for token validation, storage, and service restart behavior.
 */
import type { LocalCommandCall, LocalCommandResult } from '../../types/command.js'
import { call as connectCall } from '../connect/connect-impl.js'
import { EmailAdapter } from '../../channels/EmailAdapter.js'
import { WebhookAdapter } from '../../channels/WebhookAdapter.js'
import { ConsoleAdapter } from '../../channels/ConsoleAdapter.js'
import {
  sendTelegramMessage,
  startTelegramService,
} from '../../services/telegram/index.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import type { ChannelAdapter } from '../../channels/ChannelAdapter.js'

type ChannelDeps = {
  connectCall: typeof connectCall
  sendTelegramMessage: typeof sendTelegramMessage
  sendWebhookMessage: (message: string, env: NodeJS.ProcessEnv) => Promise<void>
  sendEmailMessage: (message: string, env: NodeJS.ProcessEnv) => Promise<void>
  sendConsoleMessage: (message: string) => Promise<void>
  connectWebhookRuntime: (env: NodeJS.ProcessEnv) => Promise<void>
  disconnectWebhookRuntime: () => Promise<boolean>
  isWebhookRuntimeConnected: () => boolean
  connectEmailRuntime: (env: NodeJS.ProcessEnv) => Promise<void>
  disconnectEmailRuntime: () => Promise<boolean>
  isEmailRuntimeConnected: () => boolean
  startTelegramService: typeof startTelegramService
  getSecureStorage: typeof getSecureStorage
  env: NodeJS.ProcessEnv
}

let channelTestDeps: Partial<ChannelDeps> | null = null
const channelRuntimeAdapters: {
  webhook: ChannelAdapter | null
  email: ChannelAdapter | null
} = {
  webhook: null,
  email: null,
}

const CHANNEL_USAGE = {
  status:
    'Usage: duckhive channel status [channel-type]\n   or: /channel status [channel-type]',
  connect:
    'Usage: duckhive channel connect <channel-type> [options]\n   or: /channel connect <channel-type> [options]',
  connectTelegram:
    'Usage: duckhive channel connect telegram --token <TOKEN>\n   or: /channel connect telegram --token <TOKEN>',
  connectWebhook:
    'Usage: duckhive channel connect webhook\n   or: /channel connect webhook',
  connectEmail:
    'Usage: duckhive channel connect email\n   or: /channel connect email',
  disconnect:
    'Usage: duckhive channel disconnect <channel-type>\n   or: /channel disconnect <channel-type>',
  disconnectTelegram:
    'Usage: duckhive channel disconnect telegram\n   or: /channel disconnect telegram',
  disconnectWebhook:
    'Usage: duckhive channel disconnect webhook\n   or: /channel disconnect webhook',
  disconnectEmail:
    'Usage: duckhive channel disconnect email\n   or: /channel disconnect email',
  send:
    'Usage: duckhive channel send <channel-type> <message>\n   or: /channel send <channel-type> <message>',
  action:
    'Usage: duckhive channel <list|status|connect|disconnect|send>\n   or: /channel <list|status|connect|disconnect|send>',
}

function formatChannelCommands(commands: string[]): string[] {
  return [
    `  terminal: ${commands.map(command => `duckhive channel ${command}`).join(' | ')}`,
    `  REPL:     ${commands.map(command => `/channel ${command}`).join(' | ')}`,
  ]
}

function getChannelDeps(): ChannelDeps {
  return {
    connectCall,
    sendTelegramMessage,
    sendWebhookMessage,
    sendEmailMessage,
    sendConsoleMessage,
    connectWebhookRuntime,
    disconnectWebhookRuntime,
    isWebhookRuntimeConnected,
    connectEmailRuntime,
    disconnectEmailRuntime,
    isEmailRuntimeConnected,
    startTelegramService,
    getSecureStorage,
    env: process.env,
    ...channelTestDeps,
  }
}

export function setChannelTestDeps(overrides: Partial<ChannelDeps> | null): void {
  channelTestDeps = overrides
}

async function sendWebhookMessage(
  message: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const adapter = new WebhookAdapter({
    outboundUrl: env.WEBHOOK_OUTBOUND_URL,
  })
  await adapter.sendMessage(message)
}

async function sendEmailMessage(
  message: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const smtpHost = env.EMAIL_SMTP_HOST ?? env.EMAIL_IMAP_HOST
  const smtpUser =
    env.EMAIL_SMTP_USER ?? env.EMAIL_IMAP_USER ?? env.EMAIL_FROM
  const smtpPassword = env.EMAIL_SMTP_PASSWORD ?? env.EMAIL_IMAP_PASSWORD
  const adapter = new EmailAdapter({
    // Allow outbound-only email configs by falling back to SMTP values.
    imapHost: env.EMAIL_IMAP_HOST ?? smtpHost,
    imapUser: env.EMAIL_IMAP_USER ?? smtpUser,
    imapPassword: env.EMAIL_IMAP_PASSWORD ?? smtpPassword,
    smtpHost,
    smtpUser,
    smtpPassword,
    fromAddress: env.EMAIL_FROM,
    defaultTo: env.EMAIL_TO,
  })
  await adapter.sendMessage(message)
}

async function sendConsoleMessage(message: string): Promise<void> {
  const adapter = new ConsoleAdapter({ prompt: '', colorize: false })
  await adapter.sendMessage(message)
}

async function connectWebhookRuntime(env: NodeJS.ProcessEnv): Promise<void> {
  if (channelRuntimeAdapters.webhook?.isConnected()) return

  const adapter = new WebhookAdapter({
    port: env.WEBHOOK_PORT ? Number(env.WEBHOOK_PORT) : undefined,
    host: env.WEBHOOK_HOST,
    path: env.WEBHOOK_PATH,
    secret: env.WEBHOOK_SECRET,
    outboundUrl: env.WEBHOOK_OUTBOUND_URL,
  })
  await adapter.connect?.()
  channelRuntimeAdapters.webhook = adapter
}

async function disconnectWebhookRuntime(): Promise<boolean> {
  const adapter = channelRuntimeAdapters.webhook
  if (!adapter) return false
  await adapter.disconnect?.()
  channelRuntimeAdapters.webhook = null
  return true
}

function isWebhookRuntimeConnected(): boolean {
  return channelRuntimeAdapters.webhook?.isConnected() ?? false
}

async function connectEmailRuntime(env: NodeJS.ProcessEnv): Promise<void> {
  if (channelRuntimeAdapters.email?.isConnected()) return

  const adapter = new EmailAdapter({
    imapHost: env.EMAIL_IMAP_HOST,
    imapUser: env.EMAIL_IMAP_USER,
    imapPassword: env.EMAIL_IMAP_PASSWORD,
    smtpHost: env.EMAIL_SMTP_HOST,
    smtpUser: env.EMAIL_SMTP_USER,
    smtpPassword: env.EMAIL_SMTP_PASSWORD,
    fromAddress: env.EMAIL_FROM,
    defaultTo: env.EMAIL_TO,
  })
  await adapter.connect?.()
  channelRuntimeAdapters.email = adapter
}

async function disconnectEmailRuntime(): Promise<boolean> {
  const adapter = channelRuntimeAdapters.email
  if (!adapter) return false
  await adapter.disconnect?.()
  channelRuntimeAdapters.email = null
  return true
}

function isEmailRuntimeConnected(): boolean {
  return channelRuntimeAdapters.email?.isConnected() ?? false
}

function boolLabel(value: boolean, yes: string, no: string): string {
  return value ? yes : no
}

function getTelegramSnapshot(storageData: ReturnType<ReturnType<typeof getSecureStorage>['read']>, env: NodeJS.ProcessEnv): string[] {
  const telegram = storageData?.pluginSecrets?.telegram
  const token =
    env.DUCKHIVE_TELEGRAM_BOT_TOKEN ??
    env.TELEGRAM_BOT_TOKEN ??
    telegram?.botToken
  const source =
    env.DUCKHIVE_TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN
      ? 'environment'
      : telegram?.botToken
        ? 'storage'
        : 'none'
  const sameTokenAsStorage = Boolean(token && telegram?.botToken && token === telegram.botToken)
  const chatId =
    env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID ??
    (sameTokenAsStorage || !env.DUCKHIVE_TELEGRAM_BOT_TOKEN && !env.TELEGRAM_BOT_TOKEN
      ? telegram?.chatId
      : undefined)

  return [
    `telegram - ${boolLabel(Boolean(token), 'configured', 'not connected')}`,
    `  token: ${token ? 'present' : 'missing'}`,
    `  chat:  ${chatId ? String(chatId) : 'not registered yet'}`,
    `  source: ${source}`,
    ...formatChannelCommands([
      'connect telegram --token <TOKEN>',
      'status telegram',
      'send telegram <MESSAGE>',
    ]),
  ]
}

function getWebhookSnapshot(env: NodeJS.ProcessEnv, runtimeConnected = false): string[] {
  const inboundReady = Boolean(env.WEBHOOK_PORT)
  const outboundReady = Boolean(env.WEBHOOK_OUTBOUND_URL)
  const configured = inboundReady || outboundReady
  return [
    `webhook - ${boolLabel(configured, 'config present', 'not configured')}`,
    `  inbound: ${env.WEBHOOK_PORT ? `port ${env.WEBHOOK_PORT}` : 'missing WEBHOOK_PORT'}`,
    `  outbound: ${env.WEBHOOK_OUTBOUND_URL ?? 'missing WEBHOOK_OUTBOUND_URL'}`,
    `  inbound: ${boolLabel(inboundReady, 'ready', 'not ready')} | outbound: ${boolLabel(outboundReady, 'ready', 'not ready')}`,
    `  runtime: ${boolLabel(runtimeConnected, 'connected', 'not connected')}`,
    ...formatChannelCommands([
      'connect webhook',
      'disconnect webhook',
      'send webhook <MESSAGE>',
    ]),
  ]
}

function getEmailSnapshot(env: NodeJS.ProcessEnv, runtimeConnected = false): string[] {
  const inboundReady = Boolean(env.EMAIL_IMAP_HOST && env.EMAIL_IMAP_USER)
  const outboundReady = Boolean(
    (env.EMAIL_SMTP_HOST ?? env.EMAIL_IMAP_HOST) &&
      (env.EMAIL_SMTP_USER ?? env.EMAIL_IMAP_USER ?? env.EMAIL_FROM) &&
      env.EMAIL_TO,
  )
  const configured = inboundReady || outboundReady
  return [
    `email - ${boolLabel(configured, 'config present', 'not configured')}`,
    `  imap: ${env.EMAIL_IMAP_HOST ?? 'missing EMAIL_IMAP_HOST'} / ${env.EMAIL_IMAP_USER ?? 'missing EMAIL_IMAP_USER'}`,
    `  smtp: ${env.EMAIL_SMTP_HOST ?? env.EMAIL_IMAP_HOST ?? 'missing EMAIL_SMTP_HOST'} / ${env.EMAIL_SMTP_USER ?? env.EMAIL_IMAP_USER ?? env.EMAIL_FROM ?? 'missing EMAIL_SMTP_USER'}`,
    `  to:   ${env.EMAIL_TO ?? 'missing EMAIL_TO'}`,
    `  inbound: ${boolLabel(inboundReady, 'ready', 'not ready')} | outbound: ${boolLabel(outboundReady, 'ready', 'not ready')}`,
    `  runtime: ${boolLabel(runtimeConnected, 'connected', 'not connected')}`,
    ...formatChannelCommands([
      'connect email',
      'disconnect email',
      'send email <MESSAGE>',
    ]),
  ]
}

function getConsoleSnapshot(): string[] {
  return [
    'console - built in',
    '  local REPL/debug channel available without extra config',
  ]
}

function formatChannelStatus(
  title: string,
  lines: string[],
): string {
  return `Channel Adapter Status

${'-'.repeat(40)}

${title}
${lines.join('\n')}
`
}

function listChannels(storageData: ReturnType<ReturnType<typeof getSecureStorage>['read']>, env: NodeJS.ProcessEnv): string {
  const sections = [
    ...getTelegramSnapshot(storageData, env),
    '',
    ...getWebhookSnapshot(env, isWebhookRuntimeConnected()),
    '',
    ...getEmailSnapshot(env, isEmailRuntimeConnected()),
    '',
    ...getConsoleSnapshot(),
  ]

  return `Channel Adapters

${'-'.repeat(40)}

${sections.join('\n')}
`
}

function isTextResult(result: LocalCommandResult): result is Extract<LocalCommandResult, { type: 'text' }> {
  return result.type === 'text'
}

function parseTelegramConnectToken(args: string[]): { token?: string; error?: string } {
  const usage = CHANNEL_USAGE.connectTelegram
  const rest = args.slice(2)
  if (rest.length === 0) return { error: usage }

  const inlineTokenArg = rest.find(arg => arg.startsWith('--token='))
  if (inlineTokenArg) {
    const token = inlineTokenArg.slice('--token='.length).trim()
    const allowed = rest.length === 1
    return token && allowed ? { token } : { error: usage }
  }

  const tokenFlagIndex = rest.indexOf('--token')
  if (tokenFlagIndex !== -1) {
    const token = rest[tokenFlagIndex + 1]?.trim()
    const allowed = rest.length === 2 && tokenFlagIndex === 0
    return token && allowed && !token.startsWith('--') ? { token } : { error: usage }
  }

  if (rest.some(arg => arg.startsWith('--token'))) {
    return { error: usage }
  }

  const token = rest.join(' ').trim()
  return token ? { token } : { error: usage }
}

export const call: LocalCommandCall = async (args: string) => {
  const {
    connectCall,
    sendTelegramMessage,
    sendWebhookMessage,
    sendEmailMessage,
    sendConsoleMessage,
    connectWebhookRuntime,
    disconnectWebhookRuntime,
    isWebhookRuntimeConnected,
    connectEmailRuntime,
    disconnectEmailRuntime,
    isEmailRuntimeConnected,
    startTelegramService,
    getSecureStorage,
    env,
  } = getChannelDeps()
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return {
      type: 'text',
      value: `${parsed.error}\n\n${CHANNEL_USAGE.action}`,
    }
  }
  const parsedArgs = parsed.args
  const action = parsedArgs[0]?.toLowerCase() ?? ''
  const channelType = parsedArgs[1]?.toLowerCase() ?? ''
  const storageData = getSecureStorage().read()

  if (!action || action === 'help' || action === '--help' || action === '-h') {
    return { type: 'text', value: listChannels(storageData, env) }
  }

  if (action === 'list') {
    return { type: 'text', value: listChannels(storageData, env) }
  }

  if (action === 'status') {
    if (parsedArgs.length > 2) {
      return {
        type: 'text',
        value: `${CHANNEL_USAGE.status}\n\nAvailable: telegram, webhook, email, console`,
      }
    }
    if (!channelType) {
      return {
        type: 'text',
        value: listChannels(storageData, env),
      }
    }
    if (channelType === 'webhook') {
      return {
        type: 'text',
        value: formatChannelStatus(
          'Webhook',
          getWebhookSnapshot(env, isWebhookRuntimeConnected()),
        ),
      }
    }
    if (channelType === 'email') {
      return {
        type: 'text',
        value: formatChannelStatus(
          'Email',
          getEmailSnapshot(env, isEmailRuntimeConnected()),
        ),
      }
    }
    if (channelType === 'console') {
      return {
        type: 'text',
        value: formatChannelStatus('Console', getConsoleSnapshot()),
      }
    }
    if (channelType && channelType !== 'telegram') {
      return {
        type: 'text',
        value: `${CHANNEL_USAGE.status}\n\nAvailable: telegram, webhook, email, console`,
      }
    }
    const result = await connectCall('status', {} as never)
    if (!isTextResult(result)) {
      throw new Error('channel status expected text result from connect command')
    }
    return {
      type: 'text',
      value: result.value.replace('Telegram Connection Status', 'Channel Adapter Status'),
    }
  }

  if (action === 'connect') {
    if (channelType === 'webhook') {
      if (parsedArgs.length > 2) {
        return {
          type: 'text',
          value: CHANNEL_USAGE.connectWebhook,
        }
      }
      try {
        await connectWebhookRuntime(env)
        return {
          type: 'text',
          value: 'Webhook adapter connected.',
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return {
          type: 'text',
          value: `Webhook connect failed. ${detail}`,
        }
      }
    }
    if (channelType === 'email') {
      if (parsedArgs.length > 2) {
        return {
          type: 'text',
          value: CHANNEL_USAGE.connectEmail,
        }
      }
      try {
        await connectEmailRuntime(env)
        return {
          type: 'text',
          value: 'Email adapter connected.',
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return {
          type: 'text',
          value: `Email connect failed. ${detail}`,
        }
      }
    }
    if (channelType !== 'telegram') {
      return {
        type: 'text',
        value:
          `${CHANNEL_USAGE.connect}\n\nAvailable: telegram (--token <TOKEN>), webhook, email`,
      }
    }
    const { token, error } = parseTelegramConnectToken(parsedArgs)
    if (!token) {
      return {
        type: 'text',
        value: error ?? CHANNEL_USAGE.connectTelegram,
      }
    }
    return connectCall(token, {} as never)
  }

  if (action === 'disconnect') {
    if (channelType === 'webhook') {
      if (parsedArgs.length > 2) {
        return {
          type: 'text',
          value: CHANNEL_USAGE.disconnectWebhook,
        }
      }
      const disconnected = await disconnectWebhookRuntime()
      return {
        type: 'text',
        value: disconnected
          ? 'Webhook adapter disconnected.'
          : 'Webhook adapter was not connected.',
      }
    }
    if (channelType === 'email') {
      if (parsedArgs.length > 2) {
        return {
          type: 'text',
          value: CHANNEL_USAGE.disconnectEmail,
        }
      }
      const disconnected = await disconnectEmailRuntime()
      return {
        type: 'text',
        value: disconnected
          ? 'Email adapter disconnected.'
          : 'Email adapter was not connected.',
      }
    }
    if (channelType !== 'telegram') {
      return {
        type: 'text',
        value:
          `${CHANNEL_USAGE.disconnect}\n\nAvailable: telegram, webhook, email`,
      }
    }
    if (parsedArgs.length > 2) {
      return {
        type: 'text',
        value: CHANNEL_USAGE.disconnectTelegram,
      }
    }
    return connectCall('disconnect', {} as never)
  }

  if (action === 'send') {
    if (
      channelType !== 'telegram' &&
      channelType !== 'webhook' &&
      channelType !== 'email' &&
      channelType !== 'console'
    ) {
      return {
        type: 'text',
        value: `${CHANNEL_USAGE.send}\n\nAvailable: telegram, webhook, email, console`,
      }
    }

    const message = parsedArgs.slice(2).join(' ').trim()
    if (!message) {
      return {
        type: 'text',
        value: `Usage: duckhive channel send ${channelType || '<channel-type>'} <message>\n   or: /channel send ${channelType || '<channel-type>'} <message>`,
      }
    }

    if (channelType === 'webhook') {
      try {
        await sendWebhookMessage(message, env)
        return {
          type: 'text',
          value: 'Webhook message sent.',
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return {
          type: 'text',
          value: `Webhook send failed. ${detail}`,
        }
      }
    }

    if (channelType === 'email') {
      try {
        await sendEmailMessage(message, env)
        return {
          type: 'text',
          value: 'Email message sent.',
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return {
          type: 'text',
          value: `Email send failed. ${detail}`,
        }
      }
    }

    if (channelType === 'console') {
      try {
        await sendConsoleMessage(message)
        return {
          type: 'text',
          value: 'Console message emitted.',
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return {
          type: 'text',
          value: `Console send failed. ${detail}`,
        }
      }
    }

    await startTelegramService()
    const sent = await sendTelegramMessage(message)
    return {
      type: 'text',
      value: sent
        ? 'Telegram message sent.'
        : 'Telegram send failed. Make sure Telegram is connected and that your bot has received /start from the allowed chat.',
    }
  }

  return {
    type: 'text',
    value:
      `Unknown channel action: ${parsedArgs[0]}\n\n` +
      `${CHANNEL_USAGE.action} [channel-type] [message]\n` +
      'Available channels: telegram, webhook, email, console',
  }
}

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (quote) {
    return { args: tokens, error: 'Unterminated quoted string in /channel arguments.' }
  }

  if (tokenStarted) tokens.push(current)
  return { args: tokens }
}
