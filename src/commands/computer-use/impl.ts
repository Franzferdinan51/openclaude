/**
 * DuckHive Computer-Use Command
 *
 * Fully integrated OpenAI Codex computer-use MCP server for DuckHive.
 *
 * Discovery order (tried in order):
 *   1. DuckHive bundled path (packages/computer-use-bundle/computer-use)
 *      — populated by install.js from /Applications/Codex.app/ or ~/.codex cache
 *   2. /Applications/Codex.app/Contents/Resources/plugins/... (Codex app bundle)
 *   3. ~/.codex/.tmp/bundled-marketplaces/... (Codex runtime cache)
 *   4. ~/.codex/plugins/... (Codex plugin directory)
 *
 * MCP tool names: mcp__computer-use__*
 *   screenshot, cursor_position, click, type_text, press_key, scroll, drag,
 *   open_application, list_apps, request_access, and 22 more.
 *
 * Gated by: macOS only (SkyComputerUseClient is a native macOS binary).
 */
import type { LocalCommandCall } from '../../types/command.js'
import { join, dirname, existsSync } from 'fs'
import { homedir } from 'os'
import { cwd } from 'process'

// ── Constants ─────────────────────────────────────────────────────────────────

const PLUGIN_NAME = 'computer-use'
const CODEX_APP_BUNDLE = 'Codex Computer Use.app'
const SKY_CLIENT_BIN = 'SkyComputerUseClient'

// ── Path discovery ─────────────────────────────────────────────────────────

/**
 * Find the computer-use plugin directory.
 * Tries DuckHive's bundled copy first, then falls back to system Codex paths.
 */
export function findComputerUsePluginDir(): string | null {
  const home = homedir()
  const candidates = [
    // 1. DuckHive bundled (install.js copies it here)
    // DuckHive runs from its root: node dist/cli.mjs → cwd() = DuckHive root
    join(cwd(), 'packages', 'computer-use-bundle', PLUGIN_NAME),
    // 2. Codex app bundle (App Store / Applications/)
    join('/Applications', CODEX_APP_BUNDLE, 'Contents', 'Resources', 'plugins', 'openai-bundled', 'plugins', PLUGIN_NAME),
    // 3. Homebrew-installed Codex
    join(home, 'Applications', CODEX_APP_BUNDLE, 'Contents', 'Resources', 'plugins', 'openai-bundled', 'plugins', PLUGIN_NAME),
    // 4. Codex runtime-extracted cache (~/.codex/.tmp/)
    join(home, '.codex', '.tmp', 'bundled-marketplaces', 'openai-bundled', 'plugins', PLUGIN_NAME),
    // 5. Codex plugin directory (~/.codex/plugins/)
    join(home, '.codex', 'plugins', PLUGIN_NAME),
  ]

  for (const dir of candidates) {
    if (isValidPluginDir(dir)) return dir
  }
  return null
}

/**
 * Verify this directory has both the .mcp.json config AND the app bundle.
 */
function isValidPluginDir(dir: string): boolean {
  return existsSync(join(dir, '.mcp.json')) &&
    existsSync(join(dir, CODEX_APP_BUNDLE, 'Contents'))
}

/**
 * Find the SkyComputerUseClient binary within the plugin directory.
 * Tries the SharedSupport path (standard) first, then top-level MacOS.
 */
export function findComputeClientBin(pluginDir: string): string | null {
  if (!pluginDir) return null
  const candidates = [
    join(pluginDir, CODEX_APP_BUNDLE, 'Contents', 'SharedSupport', 'SkyComputerUseClient.app', 'Contents', 'MacOS', SKY_CLIENT_BIN),
    join(pluginDir, CODEX_APP_BUNDLE, 'Contents', 'MacOS', SKY_CLIENT_BIN),
  ]
  for (const bin of candidates) {
    if (existsSync(bin)) return bin
  }
  return null
}

// ── MCP Config ───────────────────────────────────────────────────────────────

/**
 * Build the stdio MCP config for the computer-use server.
 */
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

// ── DuckHive MCP config wiring ───────────────────────────────────────────────

/**
 * Add the computer-use MCP server to DuckHive's config so it's auto-loaded.
 */
export async function addToDuckHiveMCP(
  binPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { addMcpConfig } = await import(
      '../../services/mcp/config.js'
    )
    const config = buildCodexCUConfig(binPath)
    await addMcpConfig(PLUGIN_NAME, config)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Remove the computer-use MCP server from DuckHive's config.
 */
export async function removeFromDuckHiveMCP(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { removeMcpConfig } = await import(
      '../../services/mcp/config.js'
    )
    await removeMcpConfig(PLUGIN_NAME)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Check if computer-use is currently in DuckHive's MCP config.
 */
export async function isInDuckHiveMCPConfig(): Promise<boolean> {
  try {
    const { getCurrentProjectConfig } = await import(
      '../../services/mcp/config.js'
    )
    const cfg = getCurrentProjectConfig()
    return Boolean(cfg.mcpServers?.[PLUGIN_NAME])
  } catch {
    return false
  }
}

/**
 * Auto-wire computer-use into DuckHive MCP if plugin is found.
 * Called on every command invocation — idempotent and silent.
 */
export async function autoWireComputerUse(): Promise<{
  wired: boolean
  pluginDir: string | null
  binPath: string | null
}> {
  // Check if already wired
  const alreadyWired = await isInDuckHiveMCPConfig()
  if (alreadyWired) {
    const pluginDir = findComputerUsePluginDir()
    const binPath = pluginDir ? findComputeClientBin(pluginDir) : null
    return { wired: true, pluginDir, binPath }
  }

  // Discover plugin
  const pluginDir = findComputerUsePluginDir()
  if (!pluginDir) return { wired: false, pluginDir: null, binPath: null }

  const binPath = findComputeClientBin(pluginDir)
  if (!binPath) return { wired: false, pluginDir, binPath: null }

  // Auto-add to DuckHive MCP config
  const result = await addToDuckHiveMCP(binPath)
  return {
    wired: result.ok,
    pluginDir,
    binPath,
  }
}

// ── Tool rendering overrides ────────────────────────────────────────────────

/**
 * TUI-friendly rendering for mcp__computer-use__* tools.
 * Provides labels + message summaries matching the tool names.
 */
export function getCodexComputerUseToolOverrides(toolName: string): {
  userFacingName: () => string
  renderToolUseMessage: (input: Record<string, unknown>) => string
} {
  const prefix = PLUGIN_NAME

  function userFacingName(): string {
    const base = toolName.replace(`mcp__${prefix}__`, '')
    const labels: Record<string, string> = {
      screenshot: '📸 Screenshot',
      cursor_position: '📍 Cursor Position',
      click: '🖱️ Click',
      left_click: '🖱️ Left Click',
      right_click: '🖱️ Right Click',
      double_click: '🖱️ Double Click',
      triple_click: '🖱️ Triple Click',
      type_text: '⌨️ Type Text',
      press_key: '⌨️ Press Key',
      hold_key: '⌨️ Hold Key',
      scroll: '📜 Scroll',
      drag: '✋ Drag',
      left_click_drag: '✋ Left-Click Drag',
      mouse_move: '🖱️ Move Mouse',
      open_application: '📱 Open App',
      list_apps: '📋 List Apps',
      get_app_state: '📋 App State',
      request_access: '🔐 Request Access',
      write_clipboard: '📋 Write Clipboard',
      read_clipboard: '📋 Read Clipboard',
      left_mouse_down: '🖱️ Mouse Down',
      left_mouse_up: '🖱️ Mouse Up',
      zoom: '🔍 Zoom',
      wait: '⏱️ Wait',
      computer_batch: '📦 Computer Batch',
    }
    return labels[base] ?? base.replace(/_/g, ' ')
  }

  function fmtCoord(c: unknown): string {
    if (!Array.isArray(c) || c.length < 2) return ''
    return `(${c[0]}, ${c[1]})`
  }

  function renderToolUseMessage(
    input: Record<string, unknown>,
  ): string {
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
        return `${input.direction ?? ''} ×${input.amount ?? '?'} at ${fmtCoord(input.coordinate)}`
      case 'drag':
      case 'left_click_drag':
        return `${fmtCoord(input.start_coordinate ?? input.from)} → ${fmtCoord(input.coordinate ?? input.to)}`
      case 'open_application':
        return typeof input.bundle_id === 'string'
          ? String(input.bundle_id)
          : typeof input.app === 'string' ? input.app : ''
      case 'write_clipboard':
        return typeof input.text === 'string' ? `"${input.text}"` : ''
      case 'wait':
        return typeof input.duration === 'number' ? `${input.duration}s` : ''
      case 'computer_batch':
        return Array.isArray(input.actions)
          ? `${input.actions.length} actions`
          : ''
      default:
        return ''
    }
  }

  return { userFacingName, renderToolUseMessage }
}

// ── CLI Command ────────────────────────────────────────────────────────────

export const call: LocalCommandCall = async (
  args: string,
): Promise<{ type: 'text'; value: string }> => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? 'status'

  // Always auto-wire on status — this makes it truly zero-config
  const { wired, pluginDir, binPath } = await autoWireComputerUse()
  const configured = wired

  if (subcommand === 'status') {
    const src = pluginDir ?? 'not found'
    const bin = binPath ?? 'not found'
    const status = pluginDir
      ? `✅ Found\n   Plugin: ${src}\n   Binary: ${bin}`
      : `⚠️ Plugin not found\n   Install Codex CLI or run \`node install.js\` to copy the plugin.`
    const configStatus = configured
      ? `✅ Auto-wired into DuckHive MCP`
      : `ℹ️ Not in DuckHive MCP config`

    return {
      type: 'text',
      value: `🦆 DuckHive Computer Use\n${'─'.repeat(50)}\n${status}\n${configStatus}\n\n32 tools: screenshot, click, type, scroll, drag, open_app, and more.\nRestart DuckHive or run \`/mcp reload\` to activate tools.`,
    }
  }

  if (subcommand === 'enable') {
    if (!pluginDir || !binPath) {
      return {
        type: 'text',
        value:
          '⚠️ computer-use plugin not found.\nRun \`node install.js\` while Codex CLI is installed, or copy the plugin from /Applications/Codex.app/.',
      }
    }
    if (configured) {
      return {
        type: 'text',
        value:
          '✅ computer-use is already wired into DuckHive MCP.\nRestart DuckHive or run \`/mcp reload\` to activate tools.',
      }
    }
    const result = await addToDuckHiveMCP(binPath)
    return {
      type: 'text',
      value: result.ok
        ? `✅ computer-use enabled!\nRestart DuckHive or run \`/mcp reload\` to activate tools.`
        : `❌ Failed: ${result.error}`,
    }
  }

  if (subcommand === 'disable') {
    if (!configured) {
      return {
        type: 'text',
        value: 'ℹ️ computer-use is not in DuckHive MCP config.',
      }
    }
    const result = await removeFromDuckHiveMCP()
    return {
      type: 'text',
      value: result.ok
        ? '✅ computer-use removed from DuckHive MCP.\nRestart DuckHive or run \`/mcp reload\` to deactivate tools.'
        : `❌ Failed: ${result.error}`,
    }
  }

  return {
    type: 'text',
    value: `🦆 Computer Use\n${'─'.repeat(50)}\n/computer-use status   — Check plugin + config status\n/computer-use enable  — Wire into DuckHive MCP\n/computer-use disable — Remove from DuckHive MCP\n\n32 tools: screenshot, click, type, scroll, drag, open_app, and more.`,
  }
}
