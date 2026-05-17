import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { AppState } from '../../state/AppState.js'
import {
  applyYoloModeToAppState,
  call,
  getYoloModeResultMessage,
} from './yolo.js'

function createAppState(
  mode: AppState['toolPermissionContext']['mode'],
  isBypassPermissionsModeAvailable = true,
): AppState {
  return {
    toolPermissionContext: {
      ...getEmptyToolPermissionContext(),
      mode,
      isBypassPermissionsModeAvailable,
    },
  } as AppState
}

describe('/yolo command', () => {
  test('uses plain terminal-safe result messages', () => {
    expect(getYoloModeResultMessage(true)).toBe(
      'Yolo mode ON - all tool calls auto-approved',
    )
    expect(getYoloModeResultMessage(false)).toBe(
      'Yolo mode OFF - normal permission checks resumed',
    )
  })

  test('enables active bypass permission mode in app state', () => {
    const updated = applyYoloModeToAppState(createAppState('default'), true)

    expect(updated.yoloMode).toBe(true)
    expect(updated.toolPermissionContext.mode).toBe('bypassPermissions')
  })

  test('disables active bypass permission mode back to default', () => {
    const updated = applyYoloModeToAppState(
      createAppState('bypassPermissions'),
      false,
    )

    expect(updated.yoloMode).toBe(false)
    expect(updated.toolPermissionContext.mode).toBe('default')
  })

  test('keeps non-bypass permission mode when disabling yolo', () => {
    const updated = applyYoloModeToAppState(createAppState('plan'), false)

    expect(updated.yoloMode).toBe(false)
    expect(updated.toolPermissionContext.mode).toBe('plan')
  })

  test('refuses to enable when bypass mode is unavailable', async () => {
    const doneMessages: string[] = []
    const result = await call(
      message => doneMessages.push(message ?? ''),
      {
        getAppState: () => createAppState('default', false),
      } as never,
      'on',
    )

    expect(result).toBeNull()
    expect(doneMessages).toEqual([
      'Cannot enable yolo mode because permission bypass is unavailable. Start DuckHive with --yolo or --dangerously-skip-permissions, or enable permissions.allowBypassPermissionsMode in settings.',
    ])
  })
})
