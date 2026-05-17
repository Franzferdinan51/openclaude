import { describe, expect, test } from 'bun:test'
import { call } from './shell-mode-impl.js'

describe('/shell-mode command', () => {
  test('renders ASCII-safe terminal help', async () => {
    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Shell Mode')
    expect(result.value).toContain('Ctrl+X  - Toggle between DuckHive and shell')
    expect([...result.value].every(char => char.charCodeAt(0) < 128)).toBe(true)
  })
})
