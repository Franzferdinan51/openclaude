import { describe, expect, test } from 'bun:test'

import {
  shouldAllowPromptStealingStartupDialogs,
  shouldRunStartupChecks,
} from './replStartupGates.js'

describe('shouldRunStartupChecks', () => {
  test('runs checks after first message submission', () => {
    expect(shouldRunStartupChecks({
      isRemoteSession: false,
      hasStarted: false,
      hasHadFirstSubmission: true,
    })).toBe(true)
  })

  test('skips checks in remote sessions even after submission', () => {
    expect(shouldRunStartupChecks({
      isRemoteSession: true,
      hasStarted: false,
      hasHadFirstSubmission: true,
    })).toBe(false)
  })

  test('skips checks if already started', () => {
    expect(shouldRunStartupChecks({
      isRemoteSession: false,
      hasStarted: true,
      hasHadFirstSubmission: true,
    })).toBe(false)
  })

  test('does not run checks before first submission', () => {
    expect(shouldRunStartupChecks({
      isRemoteSession: false,
      hasStarted: false,
      hasHadFirstSubmission: false,
    })).toBe(false)
  })

  test('does not run checks when idle before first submission', () => {
    expect(shouldRunStartupChecks({
      isRemoteSession: false,
      hasStarted: false,
      hasHadFirstSubmission: false,
    })).toBe(false)
  })

  test('skips checks in remote session regardless of other conditions', () => {
    expect(shouldRunStartupChecks({
      isRemoteSession: true,
      hasStarted: false,
      hasHadFirstSubmission: false,
    })).toBe(false)
  })
})

describe('shouldAllowPromptStealingStartupDialogs', () => {
  test('blocks prompt-stealing startup dialogs before first submission', () => {
    expect(
      shouldAllowPromptStealingStartupDialogs({
        hasHadFirstSubmission: false,
      }),
    ).toBe(false)
  })

  test('allows startup dialogs after first submission', () => {
    expect(
      shouldAllowPromptStealingStartupDialogs({
        hasHadFirstSubmission: true,
      }),
    ).toBe(true)
  })
})
