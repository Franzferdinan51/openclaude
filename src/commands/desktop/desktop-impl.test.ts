import { describe, expect, test } from 'bun:test'
import { call } from './desktop-impl.js'
import desktopCommand from './index.js'

describe('/desktop command', () => {
  test('renders ASCII-safe desktop automation help', async () => {
    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
    expect(result.value).toContain('DuckHive Desktop Control')
    expect(result.value).toContain('desktop_control screenshot')
    expect(result.value).toContain('APPROVAL REQUIRED')
  })

  test('uses an ASCII-safe command description', () => {
    expect(/[^\x00-\x7F]/.test(desktopCommand.description)).toBe(false)
  })
})
