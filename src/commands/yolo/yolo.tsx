import * as React from 'react'
import { useState } from 'react'
import { setSessionBypassPermissionsMode } from '../../bootstrap/state.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Box, Text } from '../../ink.js'
import { type AppState, useSetAppState } from '../../state/AppState.js'
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js'
import { transitionPermissionMode } from '../../utils/permissions/permissionSetup.js'
import { getSettings_DEPRECATED, updateSettingsForSource } from '../../utils/settings/settings.js'

export function isYoloModeEnabled(): boolean {
  // Check CLI flag first (--yolo sets this env var)
  if (process.env.CLAUDE_CODE_YOLO === '1') {
    return true
  }
  const settings = getSettings_DEPRECATED()
  return settings?.permissions?.yoloMode === true
}

export function getYoloModeResultMessage(enable: boolean): string {
  return enable
    ? 'Yolo mode ON - all tool calls auto-approved'
    : 'Yolo mode OFF - normal permission checks resumed'
}

export function applyYoloModeToAppState(prev: AppState, enable: boolean): AppState {
  const currentContext = prev.toolPermissionContext
  const nextMode = enable
    ? 'bypassPermissions'
    : currentContext.mode === 'bypassPermissions'
      ? 'default'
      : currentContext.mode
  const transitionedContext = transitionPermissionMode(
    currentContext.mode,
    nextMode,
    currentContext,
  )

  return {
    ...prev,
    yoloMode: enable,
    toolPermissionContext: {
      ...transitionedContext,
      mode: nextMode,
    },
  }
}

function applyYoloMode(enable: boolean, setAppState: (f: (prev: AppState) => AppState) => void): void {
  updateSettingsForSource('userSettings', {
    permissions: {
      yoloMode: enable ? true : undefined,
    },
  })
  setSessionBypassPermissionsMode(enable)
  setAppState((prev) => applyYoloModeToAppState(prev, enable))
}

interface YoloPickerProps {
  onDone: LocalJSXCommandOnDone
  initialYoloMode: boolean
}

export function YoloPicker({ onDone, initialYoloMode }: YoloPickerProps): React.ReactElement {
  const [enableYoloMode] = useState(initialYoloMode)
  const setAppState = useSetAppState()

  function handleConfirm() {
    applyYoloMode(enableYoloMode, setAppState)
    onDone(getYoloModeResultMessage(enableYoloMode))
  }

  function handleCancel() {
    onDone('Cancelled')
  }

  return (
    <Dialog
      title="Yolo Mode"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmLabel={enableYoloMode ? 'Enable Yolo' : 'Disable Yolo'}
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          Yolo mode auto-approves all tool calls without prompting for permission.
        </Text>
        <Text color="cyan" dimColor>
          Use with caution - all commands will execute immediately.
        </Text>
      </Box>
    </Dialog>
  )
}

export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext, args?: string): Promise<React.ReactNode | null> {
  const currentlyEnabled = isYoloModeEnabled()
  const parts = args?.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const subcommand = parts?.[0]

  let targetState: boolean
  if (subcommand === 'on') {
    targetState = true
  } else if (subcommand === 'off') {
    targetState = false
  } else if (subcommand === 'toggle' || !subcommand) {
    targetState = !currentlyEnabled
  } else {
    onDone(`Unknown subcommand: ${subcommand}. Use: /yolo [on|off|toggle]`)
    return null
  }

  if (targetState && !context.getAppState().toolPermissionContext.isBypassPermissionsModeAvailable) {
    onDone('Cannot enable yolo mode because permission bypass is unavailable. Start DuckHive with --yolo or --dangerously-skip-permissions, or enable permissions.allowBypassPermissionsMode in settings.')
    return null
  }

  if (targetState === currentlyEnabled) {
    onDone(currentlyEnabled ? 'Yolo mode is already ON' : 'Yolo mode is already OFF')
    return null
  }

  return <YoloPicker onDone={onDone} initialYoloMode={targetState} />
}
