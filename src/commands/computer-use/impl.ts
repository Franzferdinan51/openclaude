/**
 * DuckHive Computer-Use Command
 *
 * Wires OpenAI Codex's computer-use MCP server into DuckHive when the native
 * macOS bundle is available. The command is safe on Windows/Linux and reports
 * that the native computer-use backend is macOS-only.
 */
import type { LocalCommandCall } from '../../types/command.js'
import { existsSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import { cwd } from 'process'
import { addMcpConfig, removeMcpConfig } from '../../services/mcp/config.js'
import { getCurrentProjectConfig } from '../../utils/config.js'

const PLUGIN_NAME = 'computer-use'
const CODEX_APP_BUNDLE = 'Codex Computer Use.app'
const SKY_CLIENT_BIN = 'SkyComputerUseClient'

type ComputerUseDeps = {
  addMcpConfig: typeof import('../../services/mcp/config.js').addMcpConfig
  cwd: typeof cwd
  existsSync: typeof existsSync
  getCurrentProjectConfig: typeof import('../../utils/config.js').getCurrentProjectConfig
  homedir: typeof homedir
  platform: typeof platform
  removeMcpConfig: typeof import('../../services/mcp/config.js').removeMcpConfig
}

let computerUseTestDeps: Partial<ComputerUseDeps> | null = null

function getComputerUseDeps(): ComputerUseDeps {
  return {
    addMcpConfig,
    cwd,
    existsSync,
    getCurrentProjectConfig,
    homedir,
    platform,
    removeMcpConfig,
    ...computerUseTestDeps,
  }
}

export function setComputerUseTestDeps(
  overrides: Partial<ComputerUseDeps> | null,
): void {
  computerUseTestDeps = overrides
}

export function isComputerUseSupportedPlatform(): boolean {
  return getComputerUseDeps().platform() === 'darwin'
}

/**
 * Find the computer-use plugin directory.
 * Tries DuckHive's bundled copy first, then falls back to system Codex paths.
 */
export function findComputerUsePluginDir(): string | null {
  if (!isComputerUseSupportedPlatform()) return null

  const { cwd, homedir } = getComputerUseDeps()
  const home = homedir()
  const candidates = [
    join(cwd(), 'packages', 'computer-use-bundle', PLUGIN_NAME),
    join(
      '/Applications',
      CODEX_APP_BUNDLE,
      'Contents',
      'Resources',
      'plugins',
      'openai-bundled',
      'plugins',
      PLUGIN_NAME,
    ),
    join(
      home,
      'Applications',
      CODEX_APP_BUNDLE,
      'Contents',
      'Resources',
      'plugins',
      'openai-bundled',
      'plugins',
      PLUGIN_NAME,
    ),
    join(
      home,
      '.codex',
      '.tmp',
      'bundled-marketplaces',
      'openai-bundled',
      'plugins',
      PLUGIN_NAME,
    ),
    join(home, '.codex', 'plugins', PLUGIN_NAME),
  ]

  for (const dir of candidates) {
    if (isValidPluginDir(dir)) return dir
  }
  return null
}

function isValidPluginDir(dir: string): boolean {
  const { existsSync } = getComputerUseDeps()
  return (
    existsSync(join(dir, '.mcp.json')) &&
    existsSync(join(dir, CODEX_APP_BUNDLE, 'Contents'))
  )
}

/**
 * Find the SkyComputerUseClient binary within the plugin directory.
 */
export function findComputeClientBin(pluginDir: string): string | null {
  if (!pluginDir || !isComputerUseSupportedPlatform()) return null

  const { existsSync } = getComputerUseDeps()
  const candidates = [
    join(
      pluginDir,
      CODEX_APP_BUNDLE,
      'Contents',
      'SharedSupport',
      'SkyComputerUseClient.app',
      'Contents',
      'MacOS',
      SKY_CLIENT_BIN,
    ),
    join(pluginDir, CODEX_APP_BUNDLE, 'Contents', 'MacOS', SKY_CLIENT_BIN),
  ]

  for (const bin of candidates) {
    if (existsSync(bin)) return bin
  }
  return null
}

export function buildCodexCUConfig(binPath: string): {
  type: 'stdio'
  command: string
  args: string[]
  env: Record<string, string>
} {
  return {
    type: 'stdio',
    command: binPath,
    args: ['mcp'],
    env: {},
  }
}

export async function addToDuckHiveMCP(
  binPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { addMcpConfig } = getComputerUseDeps()
    await addMcpConfig(PLUGIN_NAME, buildCodexCUConfig(binPath), 'project')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function removeFromDuckHiveMCP(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { removeMcpConfig } = getComputerUseDeps()
    await removeMcpConfig(PLUGIN_NAME, 'project')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function isInDuckHiveMCPConfig(): Promise<boolean> {
  try {
    const { getCurrentProjectConfig } = getComputerUseDeps()
    const cfg = getCurrentProjectConfig()
    return Boolean(cfg.mcpServers?.[PLUGIN_NAME])
  } catch {
    return false
  }
}

/**
 * Auto-wire computer-use into DuckHive MCP if the plugin is found.
 * The operation is idempotent and silent.
 */
export async function autoWireComputerUse(): Promise<{
  wired: boolean
  pluginDir: string | null
  binPath: string | null
}> {
  if (!isComputerUseSupportedPlatform()) {
    return { wired: false, pluginDir: null, binPath: null }
  }

  const alreadyWired = await isInDuckHiveMCPConfig()
  if (alreadyWired) {
    const pluginDir = findComputerUsePluginDir()
    const binPath = pluginDir ? findComputeClientBin(pluginDir) : null
    return { wired: true, pluginDir, binPath }
  }

  const pluginDir = findComputerUsePluginDir()
  if (!pluginDir) return { wired: false, pluginDir: null, binPath: null }

  const binPath = findComputeClientBin(pluginDir)
  if (!binPath) return { wired: false, pluginDir, binPath: null }

  const result = await addToDuckHiveMCP(binPath)
  return {
    wired: result.ok,
    pluginDir,
    binPath,
  }
}

export function getCodexComputerUseToolOverrides(toolName: string): {
  userFacingName: () => string
  renderToolUseMessage: (input: Record<string, unknown>) => string
} {
  const prefix = PLUGIN_NAME

  function userFacingName(): string {
    const base = toolName.replace(`mcp__${prefix}__`, '')
    const labels: Record<string, string> = {
      screenshot: 'Screenshot',
      cursor_position: 'Cursor Position',
      click: 'Click',
      left_click: 'Left Click',
      right_click: 'Right Click',
      double_click: 'Double Click',
      triple_click: 'Triple Click',
      type_text: 'Type Text',
      press_key: 'Press Key',
      hold_key: 'Hold Key',
      scroll: 'Scroll',
      drag: 'Drag',
      left_click_drag: 'Left-Click Drag',
      mouse_move: 'Move Mouse',
      open_application: 'Open App',
      list_apps: 'List Apps',
      get_app_state: 'App State',
      request_access: 'Request Access',
      write_clipboard: 'Write Clipboard',
      read_clipboard: 'Read Clipboard',
      left_mouse_down: 'Mouse Down',
      left_mouse_up: 'Mouse Up',
      zoom: 'Zoom',
      wait: 'Wait',
      computer_batch: 'Computer Batch',
    }
    return labels[base] ?? base.replace(/_/g, ' ')
  }

  function fmtCoord(c: unknown): string {
    if (!Array.isArray(c) || c.length < 2) return ''
    return `(${c[0]}, ${c[1]})`
  }

  function renderToolUseMessage(input: Record<string, unknown>): string {
    const base = toolName.replace(`mcp__${prefix}__`, '')
    switch (base) {
      case 'screenshot':
      case 'cursor_position':
      case 'read_clipboard':
      case 'list_apps':
        return ''
      case 'click':
      case 'left_click':
      case 'right_click':
      case 'double_click':
      case 'triple_click':
      case 'mouse_move':
        return fmtCoord(input.coordinate ?? input.position)
      case 'type_text':
        return typeof input.text === 'string' ? `"${input.text}"` : ''
      case 'press_key':
      case 'key':
      case 'hold_key':
        return typeof input.key === 'string' ? input.key : ''
      case 'scroll':
        return `${input.direction ?? ''} x${input.amount ?? '?'} at ${fmtCoord(input.coordinate)}`
      case 'drag':
      case 'left_click_drag':
        return `${fmtCoord(input.start_coordinate ?? input.from)} -> ${fmtCoord(input.coordinate ?? input.to)}`
      case 'open_application':
        return typeof input.bundle_id === 'string'
          ? String(input.bundle_id)
          : typeof input.app === 'string'
            ? input.app
            : ''
      case 'write_clipboard':
        return typeof input.text === 'string' ? `"${input.text}"` : ''
      case 'wait':
        return typeof input.duration === 'number' ? `${input.duration}s` : ''
      case 'computer_batch':
        return Array.isArray(input.actions) ? `${input.actions.length} actions` : ''
      default:
        return ''
    }
  }

  return { userFacingName, renderToolUseMessage }
}

export const call: LocalCommandCall = async (
  args: string,
): Promise<{ type: 'text'; value: string }> => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? 'status'

  if (!isComputerUseSupportedPlatform()) {
    return {
      type: 'text',
      value:
        'DuckHive Computer Use\n' +
        'Native OpenAI Codex computer-use requires macOS because it depends on SkyComputerUseClient.\n' +
        'Use /desktop for DuckHive desktop automation on this platform.',
    }
  }

  if (subcommand === 'status') {
    const { wired, pluginDir, binPath } = await autoWireComputerUse()
    const src = pluginDir ?? 'not found'
    const bin = binPath ?? 'not found'
    const status = pluginDir
      ? `Found\n   Plugin: ${src}\n   Binary: ${bin}`
      : 'Plugin not found\n   Install Codex CLI or run `node install.js` to copy the plugin.'
    const configStatus = wired
      ? 'Auto-wired into DuckHive MCP'
      : 'Not in DuckHive MCP config'

    return {
      type: 'text',
      value:
        `DuckHive Computer Use\n${'-'.repeat(50)}\n` +
        `${status}\n${configStatus}\n\n` +
        '32 tools: screenshot, click, type, scroll, drag, open_app, and more.\n' +
        'Restart DuckHive or run `/mcp reload` to activate tools.',
    }
  }

  const configured = await isInDuckHiveMCPConfig()
  const pluginDir = findComputerUsePluginDir()
  const binPath = pluginDir ? findComputeClientBin(pluginDir) : null

  if (subcommand === 'enable') {
    if (configured) {
      return {
        type: 'text',
        value:
          'computer-use is already wired into DuckHive MCP.\n' +
          'Restart DuckHive or run `/mcp reload` to activate tools.',
      }
    }
    if (!pluginDir || !binPath) {
      return {
        type: 'text',
        value:
          'computer-use plugin not found.\n' +
          'Run `node install.js` while Codex CLI is installed, or copy the plugin from /Applications/Codex.app/.',
      }
    }
    const result = await addToDuckHiveMCP(binPath)
    return {
      type: 'text',
      value: result.ok
        ? 'computer-use enabled.\nRestart DuckHive or run `/mcp reload` to activate tools.'
        : `Failed: ${result.error}`,
    }
  }

  if (subcommand === 'disable') {
    if (!configured) {
      return {
        type: 'text',
        value: 'computer-use is not in DuckHive MCP config.',
      }
    }
    const result = await removeFromDuckHiveMCP()
    return {
      type: 'text',
      value: result.ok
        ? 'computer-use removed from DuckHive MCP.\nRestart DuckHive or run `/mcp reload` to deactivate tools.'
        : `Failed: ${result.error}`,
    }
  }

  return {
    type: 'text',
    value:
      `Computer Use\n${'-'.repeat(50)}\n` +
      '/computer-use status  - Check plugin and config status\n' +
      '/computer-use enable  - Wire into DuckHive MCP\n' +
      '/computer-use disable - Remove from DuckHive MCP\n\n' +
      '32 tools: screenshot, click, type, scroll, drag, open_app, and more.',
  }
}
