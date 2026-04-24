import { spawn } from 'child_process'
import type { LocalCommandCall } from '../../types/command.js'
import {
  DUCKHIVE_UI_SURFACE_LABELS,
  normalizeDuckHiveUISurface,
  setDuckHiveUISurfacePreferenceSync,
  type DuckHiveUISurface,
} from '../../utils/duckhiveUi.js'

function getCurrentUISurface(): DuckHiveUISurface {
  return process.env.DUCKHIVE_AUTO_TUI === '1' ? 'tui' : 'legacy'
}

function resolveTargetUISurface(
  rawArgs: string,
): { target?: DuckHiveUISurface; error?: string } {
  const args = rawArgs.trim()
  if (!args) {
    return {
      target: 'tui',
    }
  }

  const normalized = normalizeDuckHiveUISurface(args)
  if (!normalized) {
    return {
      error:
        'Usage: /tui [tui|legacy]\n\nUse /tui for the Go TUI, or /tui legacy for the classic REPL.',
    }
  }

  return { target: normalized }
}

function formatSwitchMessage(surface: DuckHiveUISurface): string {
  return `Default UI set to ${DUCKHIVE_UI_SURFACE_LABELS[surface]}.`
}

export const call: LocalCommandCall = async (args: string) => {
  const currentSurface = getCurrentUISurface()
  const { target, error } = resolveTargetUISurface(args)

  if (!target) {
    return {
      type: 'text',
      value: error ?? 'Could not determine which UI to switch to.',
    }
  }

  setDuckHiveUISurfacePreferenceSync(target)

  if (target === currentSurface) {
    return {
      type: 'text',
      value: `${formatSwitchMessage(target)} Already using it in this session.`,
    }
  }

  if (currentSurface !== 'legacy') {
    return {
      type: 'text',
      value:
        'Immediate handoff from the Go TUI is handled in the TUI process. Your default UI was still updated. Use /repl or /tui legacy there to switch back.',
    }
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return {
      type: 'text',
      value: 'UI switching requires an interactive terminal.',
    }
  }

  const launcherEntry = process.argv[1]
  if (!launcherEntry) {
    return {
      type: 'text',
      value: 'Could not determine the DuckHive launcher entrypoint.',
    }
  }

  const env = {
    ...process.env,
    DUCKHIVE_DEFAULT_UI_SURFACE: 'tui',
    DUCKHIVE_TUI_DIRECT: '1',
  }
  delete env.DUCKHIVE_AUTO_TUI
  delete env.DUCKHIVE_NO_AUTO_TUI

  return await new Promise(resolve => {
    try {
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    } catch {
      // Best effort: the spawned TUI will report a terminal error if raw mode
      // could not be released by the parent REPL.
    }

    const child = spawn(process.execPath, [launcherEntry, 'tui'], {
      stdio: 'inherit',
      env,
    })

    child.once('error', err => {
      resolve({
        type: 'text',
        value: `Failed to launch the Go TUI: ${err.message}`,
      })
    })

    child.once('spawn', () => {
      setTimeout(() => process.exit(0), 0)
      resolve({ type: 'skip' })
    })
  })
}
