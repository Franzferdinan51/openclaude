import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { AppState } from '../../state/AppState.js'
import {
  applyPermissionProfileToAppState,
  buildPermissionProfileSettings,
  parsePermissionProfileCommand,
  renderPermissionProfileList,
  renderPermissionProfileStatus,
} from './permission-profiles.js'

function appState(mode: AppState['toolPermissionContext']['mode']): AppState {
  return {
    yoloMode: false,
    toolPermissionContext: {
      ...getEmptyToolPermissionContext(),
      mode,
      isBypassPermissionsModeAvailable: false,
    },
  } as AppState
}

describe('permission profiles', () => {
  test('parses profile commands with local default and explicit destinations', () => {
    expect(parsePermissionProfileCommand('profile safe')).toEqual({
      action: 'apply',
      profile: 'safe',
      source: 'localSettings',
    })
    expect(parsePermissionProfileCommand('profiles edit --project')).toEqual({
      action: 'apply',
      profile: 'edit',
      source: 'projectSettings',
    })
    expect(parsePermissionProfileCommand('profile yolo --user')).toEqual({
      action: 'apply',
      profile: 'yolo',
      source: 'userSettings',
    })
    expect(parsePermissionProfileCommand('profile status')).toEqual({
      action: 'status',
    })
  })

  test('rejects unknown profiles and options before mutation', () => {
    expect(parsePermissionProfileCommand('profile reckless')).toEqual({
      action: 'error',
      message:
        'Unknown permission profile: reckless. Use /permissions profile list.',
    })
    expect(parsePermissionProfileCommand('profile safe --global')).toEqual({
      action: 'error',
      message:
        'Unknown permission profile option: --global. Use --local, --project, or --user.',
    })
  })

  test('builds safe profile settings with plan mode and strict sandbox', () => {
    expect(buildPermissionProfileSettings('safe')).toEqual({
      permissions: {
        defaultMode: 'plan',
        allowBypassPermissionsMode: undefined,
        yoloMode: undefined,
      },
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: false,
        allowUnsandboxedCommands: false,
      },
    })
  })

  test('builds yolo profile settings with explicit bypass availability', () => {
    expect(buildPermissionProfileSettings('yolo')).toEqual({
      permissions: {
        defaultMode: 'bypassPermissions',
        allowBypassPermissionsMode: true,
        yoloMode: true,
      },
      sandbox: {
        enabled: false,
        autoAllowBashIfSandboxed: false,
        allowUnsandboxedCommands: true,
      },
    })
  })

  test('updates active app state to match the selected profile', () => {
    const safe = applyPermissionProfileToAppState(appState('default'), 'safe')
    expect(safe.toolPermissionContext.mode).toBe('plan')
    expect(safe.yoloMode).toBe(false)

    const yolo = applyPermissionProfileToAppState(appState('default'), 'yolo')
    expect(yolo.toolPermissionContext.mode).toBe('bypassPermissions')
    expect(yolo.toolPermissionContext.isBypassPermissionsModeAvailable).toBe(
      true,
    )
    expect(yolo.yoloMode).toBe(true)
  })

  test('renders list and status text for terminal use', () => {
    const list = renderPermissionProfileList()
    expect(list).toContain('safe: Safe planning')
    expect(list).toContain('balanced: Balanced harness')
    expect(list).toContain('yolo: Yolo bypass')

    const status = renderPermissionProfileStatus({
      permissions: {
        defaultMode: 'acceptEdits',
        allowBypassPermissionsMode: true,
        yoloMode: false,
      },
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
        allowUnsandboxedCommands: false,
      },
    })
    expect(status).toContain('defaultMode: acceptEdits')
    expect(status).toContain('allowBypassPermissionsMode: on')
    expect(status).toContain(
      'sandbox: enabled, auto-allow bash on, unsandboxed fallback off',
    )
  })
})
