import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { call, setChannelTestDeps } from './channel-impl.js'

let connectCall: ReturnType<typeof mock>

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

describe('/channel command', () => {
  beforeEach(() => {
    connectCall = mock(async (args: string) => ({
      type: 'text' as const,
      value: `connect:${args}`,
    }))

    setChannelTestDeps({
      connectCall,
    })
  })

  afterEach(() => {
    setChannelTestDeps(null)
  })

  test('shows channel help when called without arguments', async () => {
    const result = expectTextResult(await call('', {} as never))

    expect(result.value).toContain('Channel Adapters')
    expect(result.value).toContain('/channel connect telegram --token <TOKEN>')
    expect(connectCall).not.toHaveBeenCalled()
  })

  test('delegates status to /connect and rewrites the heading', async () => {
    connectCall.mockImplementationOnce(async () => ({
      type: 'text' as const,
      value: 'Telegram Connection Status\nStatus: Connected',
    }))

    const result = expectTextResult(await call('status', {} as never))

    expect(connectCall).toHaveBeenCalledWith('status', expect.anything())
    expect(result.value).toContain('Channel Adapter Status')
    expect(result.value).toContain('Status: Connected')
  })

  test('delegates telegram connect to /connect with the provided token', async () => {
    const result = expectTextResult(
      await call('connect telegram 123456789:ABCDEFGHIJKLMNOPQRSTUVWX', {} as never),
    )

    expect(connectCall).toHaveBeenCalledWith(
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
      expect.anything(),
    )
    expect(result.value).toBe('connect:123456789:ABCDEFGHIJKLMNOPQRSTUVWX')
  })

  test('delegates documented --token syntax without forwarding the flag', async () => {
    const result = expectTextResult(
      await call('connect telegram --token 123456789:ABCDEFGHIJKLMNOPQRSTUVWX', {} as never),
    )

    expect(connectCall).toHaveBeenCalledWith(
      '123456789:ABCDEFGHIJKLMNOPQRSTUVWX',
      expect.anything(),
    )
    expect(result.value).toBe('connect:123456789:ABCDEFGHIJKLMNOPQRSTUVWX')
  })

  test('delegates telegram disconnect to /connect', async () => {
    const result = expectTextResult(await call('disconnect telegram', {} as never))

    expect(connectCall).toHaveBeenCalledWith('disconnect', expect.anything())
    expect(result.value).toBe('connect:disconnect')
  })

  test('rejects unsupported channel types', async () => {
    const result = expectTextResult(await call('connect slack token', {} as never))

    expect(result.value).toContain('Available: telegram')
    expect(connectCall).not.toHaveBeenCalled()
  })
})
