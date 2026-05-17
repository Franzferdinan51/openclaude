import { describe, expect, test } from 'bun:test'
import { Writable } from 'node:stream'
import { ConsoleAdapter } from './ConsoleAdapter.js'

class CaptureStream extends Writable {
  chunks: string[] = []

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.chunks.push(String(chunk))
    callback()
  }

  text(): string {
    return this.chunks.join('')
  }
}

function runBuiltIn(adapter: ConsoleAdapter, input: string) {
  return (adapter as unknown as {
    handleBuiltIn(input: string): unknown
  }).handleBuiltIn(input)
}

describe('ConsoleAdapter built-ins', () => {
  test('help documents the real model forwarding command instead of a stub', () => {
    const output = new CaptureStream()
    const adapter = new ConsoleAdapter({
      prompt: '',
      colorize: false,
      outputStream: output,
    })

    const result = runBuiltIn(adapter, 'help')

    expect(result).toBeNull()
    expect(output.text()).toContain('model <id> — Forward /model <id> to DuckHive')
    expect(output.text()).not.toContain('stub')
  })

  test('model command forwards to the DuckHive slash command path', () => {
    const adapter = new ConsoleAdapter({
      prompt: '',
      colorize: false,
      sourceLabel: 'console-test',
    })

    const result = runBuiltIn(adapter, 'model minimax-m2.7')

    expect(result).toMatchObject({
      from: 'console-test',
      source: 'user',
      content: '/model minimax-m2.7',
    })
  })
})
