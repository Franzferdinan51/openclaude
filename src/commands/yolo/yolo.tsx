import * as React from 'react'
import { useState } from 'react'
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Box, Text } from '../../ink.js'
import { type AppState, useAppState, useSetAppState } from '../../state/AppState.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'
import { getSettings_DEPRECATED } from '../../utils/settings/settings.js'

export function isYoloModeEnabled(): boolean {
  const settings = getSettings_DEPRECATED()
  return settings?.permissions?.yoloMode === true
}

function applyYoloMode(enable: boolean, setAppState: (f: (prev: AppState) => AppState) => void): void {
  updateSettingsForSource('userSettings', {
    permissions: {
      yoloMode: enable ? true : undefined,
    },
  })
  setAppState((prev) => ({
    ...prev,
    yoloMode: enable,
  }))
}

interface YoloPickerProps {
  onDone: LocalJSXCommandOnDone
  initialYoloMode: boolean
}

export function YoloPicker({ onDone, initialYoloMode }: YoloPickerProps): React.ReactElement {
  const [enableYoloMode, setEnableYoloMode] = useState(initialYoloMode)
  const setAppState = useSetAppState()

  function handleConfirm() {
    applyYoloMode(enableYoloMode, setAppState)
    if (enableYoloMode) {
      onDone('🔓 Yolo mode ON - all tool calls auto-approved')
    } else {
      onDone('🔒 Yolo mode OFF - normal permission checks resumed')
    }
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

  if (targetState === currentlyEnabled) {
    onDone(currentlyEnabled ? 'Yolo mode is already ON' : 'Yolo mode is already OFF')
    return null
  }

  return <YoloPicker onDone={onDone} initialYoloMode={targetState} />
}
