import { getSecureStorage, type SecureStorageData } from '../../utils/secureStorage/index.js'

export type TelegramWebUiStatus = {
  configured: boolean
  allowlistConfigured: boolean
  source?: 'environment' | 'storage'
  chatIdConfigured: boolean
  connectedAt?: string
}

type TelegramStatusDeps = {
  storageData?: SecureStorageData | null
}

function readStoredTelegramConfig(deps: TelegramStatusDeps): Record<string, string> {
  try {
    return deps.storageData?.pluginSecrets?.telegram ?? getSecureStorage().read()?.pluginSecrets?.telegram ?? {}
  } catch {
    return {}
  }
}

export function getTelegramWebUiStatus(
  env: NodeJS.ProcessEnv = process.env,
  deps: TelegramStatusDeps = {},
): TelegramWebUiStatus {
  const storageConfig = readStoredTelegramConfig(deps)
  const envToken = env.DUCKHIVE_TELEGRAM_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN
  const sameTokenAsStorage = Boolean(envToken && envToken === storageConfig.botToken)
  const token = envToken ?? storageConfig.botToken
  const chatId = env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID ?? (sameTokenAsStorage || !envToken ? storageConfig.chatId : undefined)
  const source = envToken ? 'environment' : token ? 'storage' : undefined

  return {
    configured: Boolean(token),
    allowlistConfigured: Boolean(env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID),
    source,
    chatIdConfigured: Boolean(chatId),
    connectedAt: sameTokenAsStorage || !envToken ? storageConfig.connectedAt : undefined,
  }
}
