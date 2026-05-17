import { describe, expect, test } from 'bun:test'
import { projectView } from './operations.js'

describe('contextCollapse operations', () => {
  test('projectView is a safe identity projection for direct-collapse mode', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    expect(projectView(messages)).toBe(messages)
  })
})
