/**
 * /channel command implementation
 *
 * This is a channel-oriented wrapper around the concrete connection flows.
 * Telegram is currently delegated to /connect so there is only one actual
 * code path for token validation, storage, and service restart behavior.
 */
import type { LocalCommandCall, LocalCommandResult } from '../../types/command.js'
import { call as connectCall } from '../connect/connect-impl.js'

type ChannelDeps = {
  connectCall: typeof connectCall
}

let channelTestDeps: Partial<ChannelDeps> | null = null

function getChannelDeps(): ChannelDeps {
  return {
    connectCall,
    ...channelTestDeps,
  }
}

export function setChannelTestDeps(overrides: Partial<ChannelDeps> | null): void {
  channelTestDeps = overrides
}

function listChannels(): string {
  return `Channel Adapters

${'-'.repeat(40)}

telegram - Telegram bot integration
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

function isTextResult(result: LocalCommandResult): result is Extract<LocalCommandResult, { type: 'text' }> {
  return result.type === 'text'
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const prefixed = `${flag}=`
  const inline = args.find(arg => arg.startsWith(prefixed))
  if (inline) return inline.slice(prefixed.length).trim()

  const index = args.indexOf(flag)
  if (index !== -1) return args[index + 1]?.trim()

  return undefined
}

export const call: LocalCommandCall = async (args: string) => {
  const { connectCall } = getChannelDeps()
  const parsedArgs = args.trim().split(/\s+/).filter(Boolean)
  const [action = '', channelType = ''] = parsedArgs

  if (!action) {
    return { type: 'text', value: listChannels() }
  }

  if (action === 'list') {
    return { type: 'text', value: listChannels() }
  }

  if (action === 'status') {
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
    if (channelType !== 'telegram') {
      return {
        type: 'text',
        value: `Usage: /channel connect <channel-type>\n\nAvailable: telegram`,
      }
    }
    const token = getFlagValue(parsedArgs, '--token') ?? parsedArgs.slice(2).join(' ').trim()
    return connectCall(token, {} as never)
  }

  if (action === 'disconnect') {
    if (channelType && channelType !== 'telegram') {
      return {
        type: 'text',
        value: `Usage: /channel disconnect <channel-type>\n\nAvailable: telegram`,
      }
    }
    return connectCall('disconnect', {} as never)
  }

  return { type: 'text', value: listChannels() }
}
