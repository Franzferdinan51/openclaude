import { describe, expect, test } from 'bun:test'

import { parseMmxArgs } from './mmx-impl.js'

describe('/mmx argument parsing', () => {
  test('preserves quoted values for MiniMax CLI flags', () => {
    expect(parseMmxArgs('text chat --message "hello world"')).toEqual([
      'text',
      'chat',
      '--message',
      'hello world',
    ])
  })

  test('supports escaped spaces', () => {
    expect(parseMmxArgs('vision ./screenshots/my\\ file.png')).toEqual([
      'vision',
      './screenshots/my file.png',
    ])
  })
})
