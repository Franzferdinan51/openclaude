import { describe, expect, test } from 'bun:test'
import { extractFirstPromptFromHead } from './sessionStoragePortable.js'

describe('extractFirstPromptFromHead', () => {
  test('uses slash-command arguments as the portable session title when present', () => {
    const head = [
      JSON.stringify({
        type: 'user',
        message: {
          content:
            '<command-message>goal</command-message>\n' +
            '<command-name>/goal</command-name>\n' +
            '<command-args>Build auth migration</command-args>',
        },
      }),
    ].join('\n')

    expect(extractFirstPromptFromHead(head)).toBe('Build auth migration')
  })

  test('falls back to the slash command name when no command args are present', () => {
    const head = [
      JSON.stringify({
        type: 'user',
        message: {
          content:
            '<command-message>goal</command-message>\n' +
            '<command-name>/goal</command-name>',
        },
      }),
    ].join('\n')

    expect(extractFirstPromptFromHead(head)).toBe('/goal')
  })
})
