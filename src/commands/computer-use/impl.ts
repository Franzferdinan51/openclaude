/**
 * DuckHive Computer-Use Command
 *
 * Wires OpenAI Codex's computer-use MCP server into DuckHive when the native
 * macOS bundle is available. The command is safe on Windows/Linux and reports
 * that the native computer-use backend is macOS-only.
 */
import type { LocalCommandCall } from '../../types/command.js'
import { feature } from 'bun:bundle'
import { existsSync } from 'fs'
import { homedir, platform } from 'os'
import { dirname, join } from 'path'
import { cwd } from 'process'
import { addMcpConfig, removeMcpConfig } from '../../services/mcp/config.js'
import { getCurrentProjectConfig } from '../../utils/config.js'

const PLUGIN_NAME = 'computer-use'
const CODEX_DESKTOP_APP_BUNDLE = 'Codex.app'
const CODEX_APP_BUNDLE = 'Codex Computer Use.app'
const SKY_CLIENT_BIN = 'SkyComputerUseClient'
const BUILTIN_COMPUTER_USE_RESERVED = feature('CHICAGO_MCP') ? true : false
const COMPUTER_USE_USAGE = {
  status: 'Usage: duckhive computer-use status\n   or: /computer-use status',
  enable: 'Usage: duckhive computer-use enable\n   or: /computer-use enable',
  disable: 'Usage: duckhive computer-use disable\n   or: /computer-use disable',
}
const COMPUTER_USE_HELP =
  `Computer Use\n${'-'.repeat(50)}\n` +
  'Terminal:\n' +
  '  duckhive computer-use status   - Check plugin and config status\n' +
  '  duckhive computer-use enable   - Wire into DuckHive MCP\n' +
  '  duckhive computer-use disable  - Remove from DuckHive MCP\n\n' +
  'REPL:\n' +
  '  /computer-use status           - Check plugin and config status\n' +
  '  /computer-use enable           - Wire into DuckHive MCP\n' +
  '  /computer-use disable          - Remove from DuckHive MCP\n\n' +
  '32 tools: screenshot, click, type, scroll, drag, open_app, and more.\n' +
  'If the Codex plugin is unavailable, use `newest-desktop-control` for desktop, Android, and computer_use_* compatibility aliases.'

type ComputerUseDeps = {
  addMcpConfig: typeof import('../../services/mcp/config.js').addMcpConfig
  cwd: typeof cwd
  existsSync: typeof existsSync
  getCurrentProjectConfig: typeof import('../../utils/config.js').getCurrentProjectConfig
  homedir: typeof homedir
  platform: typeof platform
  processEnv: NodeJS.ProcessEnv
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
    processEnv: process.env,
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

function isBuiltinComputerUseReserved(): boolean {
  return BUILTIN_COMPUTER_USE_RESERVED
}

export function hasBuiltinComputerUseRuntime(): boolean {
  return BUILTIN_COMPUTER_USE_RESERVED
}

function configuredPluginDirsFromEnv(): string[] {
  const { processEnv } = getComputerUseDeps()
  return [
    processEnv.DUCKHIVE_CODEX_COMPUTER_USE_PLUGIN_DIR,
    processEnv.CODEX_COMPUTER_USE_PLUGIN_DIR,
  ].filter((value): value is string => Boolean(value))
}

function configuredClientPathsFromEnv(): string[] {
  const { processEnv } = getComputerUseDeps()
  return [
    processEnv.DUCKHIVE_CODEX_COMPUTER_USE_CLIENT,
    processEnv.CODEX_COMPUTER_USE_CLIENT,
  ].filter((value): value is string => Boolean(value))
}

/**
 * Find the computer-use plugin directory.
 * Tries DuckHive's bundled copy first, then falls back to system Codex paths.
 */
export function findComputerUsePluginDir(): string | null {
  if (!isComputerUseSupportedPlatform()) return null

  const { cwd, homedir } = getComputerUseDeps()
  const { existsSync } = getComputerUseDeps()
  const home = homedir()
  const candidates = [
    ...configuredPluginDirsFromEnv(),
    join(cwd(), 'packages', 'computer-use-bundle', PLUGIN_NAME),
    join(
      '/Applications',
      CODEX_DESKTOP_APP_BUNDLE,
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
      CODEX_DESKTOP_APP_BUNDLE,
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
  for (const clientPath of configuredClientPathsFromEnv()) {
    if (existsSync(clientPath)) return dirname(clientPath)
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
    ...configuredClientPathsFromEnv(),
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
  configured: boolean
  pluginDir: string | null
  binPath: string | null
}> {
  if (!isComputerUseSupportedPlatform()) {
    return { wired: false, configured: false, pluginDir: null, binPath: null }
  }

  const alreadyWired = await isInDuckHiveMCPConfig()
  if (alreadyWired) {
    const pluginDir = findComputerUsePluginDir()
    const binPath = pluginDir ? findComputeClientBin(pluginDir) : null
    return { wired: true, configured: true, pluginDir, binPath }
  }

  const pluginDir = findComputerUsePluginDir()
  if (!pluginDir) {
    return { wired: false, configured: false, pluginDir: null, binPath: null }
  }

  const binPath = findComputeClientBin(pluginDir)
  if (!binPath) return { wired: false, configured: false, pluginDir, binPath: null }

  const result = await addToDuckHiveMCP(binPath)
  return {
    wired: result.ok,
    configured: result.ok,
    pluginDir,
    binPath,
  }
}

export async function inspectComputerUse(): Promise<{
  configured: boolean
  pluginDir: string | null
  binPath: string | null
}> {
  if (!isComputerUseSupportedPlatform()) {
    return { configured: false, pluginDir: null, binPath: null }
  }

  const configured = await isInDuckHiveMCPConfig()
  const pluginDir = findComputerUsePluginDir()
  const binPath = pluginDir ? findComputeClientBin(pluginDir) : null
  return { configured, pluginDir, binPath }
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

  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    return { type: 'text', value: COMPUTER_USE_HELP }
  }

  if (!['status', 'enable', 'disable'].includes(subcommand)) {
    return {
      type: 'text',
      value: `Unknown computer-use action: ${subcommand}\n\n${COMPUTER_USE_HELP}`,
    }
  }

  if (subcommand === 'status' && parts.length > 1) {
    return {
      type: 'text',
      value: COMPUTER_USE_USAGE.status,
    }
  }

  if (subcommand === 'enable' && parts.length > 1) {
    return {
      type: 'text',
      value: COMPUTER_USE_USAGE.enable,
    }
  }

  if (subcommand === 'disable' && parts.length > 1) {
    return {
      type: 'text',
      value: COMPUTER_USE_USAGE.disable,
    }
  }

  if (subcommand === 'disable') {
    const configured = await isInDuckHiveMCPConfig()
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
        ? 'computer-use removed from DuckHive MCP.\nRestart DuckHive or run `duckhive mcp reload` / `/mcp reload` to deactivate tools.'
        : `Failed: ${result.error}`,
    }
  }

  if (!isComputerUseSupportedPlatform()) {
    const configured = await isInDuckHiveMCPConfig()
    const staleConfigGuidance = configured
      ? '\n\nStale MCP config detected: `computer-use` is configured for this project, but native Codex computer-use cannot run on this platform. Run `duckhive computer-use disable` or `/computer-use disable` to remove the stale entry, then use `newest-desktop-control` for cross-platform automation.'
      : ''
    return {
      type: 'text',
      value:
        'DuckHive Computer Use\n' +
        'Native OpenAI Codex computer-use requires macOS because it depends on SkyComputerUseClient.\n' +
        'On this platform, use `duckhive desktop` / `/desktop` for the legacy automation surface or the bundled `newest-desktop-control` MCP gateway for cross-platform desktop, Android, and computer_use_* compatibility tools.' +
        staleConfigGuidance,
    }
  }

  if (subcommand === 'status') {
    const { configured, pluginDir, binPath } = await inspectComputerUse()
    const src = pluginDir ?? 'not found'
    const bin = binPath ?? 'not found'
    const status = pluginDir
      ? `Found\n   Plugin: ${src}\n   Binary: ${bin}`
      : 'Plugin not found\n   Install Codex CLI or run `node install.js` to copy the plugin.'
    const configStatus = configured
      ? pluginDir && binPath
        ? 'Configured in DuckHive MCP'
        : 'Configured in DuckHive MCP, but the plugin bundle is currently missing'
      : isBuiltinComputerUseReserved()
        ? 'Reserved for DuckHive built-in computer-use runtime'
      : 'Not in DuckHive MCP config'
    const nextStep = configured
      ? pluginDir && binPath
        ? 'Restart DuckHive or run `duckhive mcp reload` / `/mcp reload` to activate tools.'
        : 'Restore the plugin bundle or run `duckhive computer-use disable` / `/computer-use disable` to remove the stale MCP entry.'
      : isBuiltinComputerUseReserved()
        ? 'This DuckHive build already reserves `computer-use` for the built-in runtime; do not wire the Codex plugin through `duckhive computer-use enable` / `/computer-use enable`.'
      : pluginDir && binPath
        ? 'Run `duckhive computer-use enable` or `/computer-use enable` to wire the plugin into DuckHive MCP.'
        : 'Install Codex.app or use the bundled `newest-desktop-control` MCP gateway for cross-platform desktop/Android tools.'

    return {
      type: 'text',
      value:
        `DuckHive Computer Use\n${'-'.repeat(50)}\n` +
        `${status}\n${configStatus}\n\n` +
        '32 tools: screenshot, click, type, scroll, drag, open_app, and more.\n' +
        'Fallback gateway: `newest-desktop-control` exposes desktop, Android, and computer_use_* compatibility aliases.\n' +
        nextStep,
    }
  }

  const configured = await isInDuckHiveMCPConfig()
  const pluginDir = findComputerUsePluginDir()
  const binPath = pluginDir ? findComputeClientBin(pluginDir) : null

  if (subcommand === 'enable') {
    if (isBuiltinComputerUseReserved()) {
      return {
        type: 'text',
        value:
          'This DuckHive build already reserves `computer-use` for the built-in runtime.\n' +
          'Use the built-in DuckHive computer-use path instead of wiring the Codex plugin through `duckhive computer-use enable` / `/computer-use enable`.',
      }
    }

    if (configured) {
      if (!pluginDir || !binPath) {
        return {
          type: 'text',
          value:
            'computer-use is configured in DuckHive MCP, but the plugin bundle is currently missing.\n' +
            'Reinstall Codex.app or restore the plugin bundle, or run `duckhive computer-use disable` / `/computer-use disable` to remove the stale MCP entry.',
        }
      }
      return {
        type: 'text',
        value:
          'computer-use is already wired into DuckHive MCP.\n' +
          'Restart DuckHive or run `duckhive mcp reload` / `/mcp reload` to activate tools.',
      }
    }
    if (!pluginDir || !binPath) {
      return {
        type: 'text',
        value:
          'computer-use plugin not found.\n' +
          'Run `node install.js` while Codex CLI is installed, copy the plugin from /Applications/Codex.app/, or use `newest-desktop-control` for the bundled desktop/Android gateway.',
      }
    }
    const result = await addToDuckHiveMCP(binPath)
    return {
      type: 'text',
      value: result.ok
        ? 'computer-use enabled.\nRestart DuckHive or run `duckhive mcp reload` / `/mcp reload` to activate tools.'
        : `Failed: ${result.error}`,
    }
  }

  return {
    type: 'text',
    value: COMPUTER_USE_HELP,
  }
}
