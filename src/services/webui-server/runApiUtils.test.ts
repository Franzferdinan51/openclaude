import { describe, expect, test } from 'bun:test'
import { parseRunEventLimit, parseRunStatusFilter } from './runApiUtils.js'

describe('parseRunStatusFilter', () => {
  test('accepts a missing status filter', () => {
    expect(parseRunStatusFilter(null)).toEqual({ ok: true })
  })

  test('accepts known AgentRun statuses', () => {
    expect(parseRunStatusFilter('running')).toEqual({ ok: true, status: 'running' })
    expect(parseRunStatusFilter('awaiting_approval')).toEqual({
      ok: true,
      status: 'awaiting_approval',
    })
  })

  test('rejects unknown statuses instead of silently returning an empty list', () => {
    const result = parseRunStatusFilter('stuck')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Invalid run status "stuck"')
      expect(result.message).toContain('running')
    }
  })
})

describe('parseRunEventLimit', () => {
  test('uses a bounded default when limit is missing or invalid', () => {
    expect(parseRunEventLimit(null)).toBe(50)
    expect(parseRunEventLimit('nope')).toBe(50)
  })

  test('floors decimal limits and clamps the lower bound', () => {
    expect(parseRunEventLimit('10.9')).toBe(10)
    expect(parseRunEventLimit('0')).toBe(1)
    expect(parseRunEventLimit('-5')).toBe(1)
  })

  test('clamps overly large limits', () => {
    expect(parseRunEventLimit('500')).toBe(200)
    expect(parseRunEventLimit('500', 50, 100)).toBe(100)
  })
})
