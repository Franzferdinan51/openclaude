export type TelegramWebUiStatus = {
  configured: boolean
  allowlistConfigured: boolean
}

export function getTelegramWebUiStatus(
  env: NodeJS.ProcessEnv = process.env,
): TelegramWebUiStatus {
  return {
    configured: Boolean(env.DUCKHIVE_TELEGRAM_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN),
    allowlistConfigured: Boolean(env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID),
  }
}
