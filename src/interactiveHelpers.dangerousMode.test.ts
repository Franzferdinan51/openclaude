import { describe, expect, test } from 'bun:test'
import { shouldShowDangerousModeDialog } from './utils/dangerousModeDialog.js'

describe('shouldShowDangerousModeDialog', () => {
  test('does not block the REPL when dangerous mode was explicitly requested', () => {
    expect(
      shouldShowDangerousModeDialog({
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: false,
        explicitDangerousMode: true,
        hasAcceptedPrompt: false,
      }),
    ).toBe(false)
  })

  test('still prompts for dangerous mode availability without explicit bypass', () => {
    expect(
      shouldShowDangerousModeDialog({
        permissionMode: 'default',
        allowDangerouslySkipPermissions: true,
        explicitDangerousMode: false,
        hasAcceptedPrompt: false,
      }),
    ).toBe(true)
  })

  test('honors the stored accepted prompt setting', () => {
    expect(
      shouldShowDangerousModeDialog({
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: false,
        explicitDangerousMode: false,
        hasAcceptedPrompt: true,
      }),
    ).toBe(false)
  })
})
