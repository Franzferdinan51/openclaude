import { test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { StatusBarTool } from './StatusBarTool.js'

test('status bar session reports current DuckHive version', async () => {
  const result = await StatusBarTool.call(
    { action: 'session' },
    {} as never,
    undefined as never,
    undefined as never,
  )
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

  expect(result.data.output).toContain(`DuckHive v${pkg.version}`)
  expect(result.data.output).not.toContain('v0.8.0')
})

test('status bar render output is ascii safe', async () => {
  const result = await StatusBarTool.call(
    { action: 'render', model: 'MiniMax-M2.7', message: 'x'.repeat(80) },
    {} as never,
    undefined as never,
    undefined as never,
  )

  expect(result.data.output).toContain('-')
  expect(result.data.output).toContain('...')
  const withoutAnsi = result.data.output?.replace(/\x1b\[[0-9;]*m/g, '') ?? ''
  expect([...withoutAnsi].every(ch => ch.charCodeAt(0) <= 127)).toBe(true)
})
