import { expect, test } from 'bun:test'
import { call } from './voice.js'

test('/voice status reports readiness without toggling', async () => {
  const result = await call('status', {} as never)

  expect(result.type).toBe('text')
  if (result.type !== 'text') throw new Error('unexpected result type')
  expect(result.value).toContain('Voice mode status')
  expect(result.value).toContain('Ready:')
  expect(result.value).toContain('/voice in the REPL')
  expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
})

test('/voice in non-interactive mode reports status without toggling', async () => {
  const result = await call('', {
    options: { isNonInteractiveSession: true },
  } as never)
  expect(result.type).toBe('text')
  if (result.type !== 'text') throw new Error('unexpected result type')
  expect(result.value).toContain('Voice mode status')
  expect(result.value).toContain('Ready:')
})

test('/voice help documents status and top-level forms', async () => {
  const result = await call('--help', {} as never)

  expect(result.type).toBe('text')
  if (result.type !== 'text') throw new Error('unexpected result type')
  expect(result.value).toContain('Voice Command')
  expect(result.value).toContain('/voice status')
  expect(result.value).toContain('duckhive voice status')
  expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
})
