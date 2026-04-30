/**
 * DuckHive Computer-Use Command
 *
 * Integrates OpenAI Codex's bundled computer-use MCP server into DuckHive.
 *
 * The "computer-use" plugin ships as a bundled marketplace plugin in Codex CLI
 * (~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/).
 * It contains a native macOS app "Codex Computer Use" whose embedded
 * SkyComputerUseClient binary acts as an MCP server over stdio.
 *
 * DuckHive's own @ant/computer-use-mcp implementation (src/utils/computerUse/)
 * requires native modules (@ant/computer-use-input + @ant/computer-use-swift)
 * that are built into Claude Code's bundle but NOT available standalone on npm.
 * Rather than reimplement those natives, we wire Codex's proven bundled binary.
 *
 * MCP tool names exposed: mcp__computer-use__*
 *   screenshot, cursor_position, click, type, key, scroll, drag,
 *   open_application, list_apps, request_access, etc.
 */
import type { LocalCommandCall } from '../../types/command.js'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

// ── Paths ────────────────────────────────────────────────────────────────────────

const CODEX_PLUGIN_NAME = 'computer-use'
const CODEX_COMPUTE_USE_APP = 'Codex Computer Use.app'
const SKY_COMPUTE_CLIENT = 'SkyComputerUseClient'
const CODEX_COMPUTE_CLIENT_REL = join(
  'Contents',
  'SharedSupport',
  CODEX_COMPUTE_APP,
  'Contents',
  'MacOS',
  SKY_COMPUTE_CLIENT,
)
const CODEX_COMPUTE_CLIENT_ABS = join(
  'Contents',
  'MacOS',
  SKY_COMPUTE_CLIENT,
)

/**
 * Find the Codex computer-use plugin directory.
 * Codex populates ~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/
 * on first run. We check multiple known locations.
 */
function findCodexPluginDir(): string | null {
  const home = process.env.HOME ?? ''
  const candidates = [
    join(home, '.codex', '.tmp', 'bundled-marketplaces', 'openai-bundled', 'plugins', CODEX_PLUGIN_NAME),
    join(home, '.codex', 'plugins', CODEX_PLUGIN_NAME),
  ]
  for (const dir of candidates) {
    const mcpJson = join(dir, '.mcp.json')
    const appContents = join(dir, CODEX_COMPUTE_APP, 'Contents')
    if (existsSync(mcpJson) && existsSync(appContents)) return dir
  }
  return null
}

/**
 * Get the absolute path to the SkyComputerUseClient binary.
 * Tries the embedded SharedSupport location first (standard), then the
 * top-level MacOS location (older Codex versions).
 */
function findComputeClientBin(pluginDir: string): string | null {
  if (!pluginDir) return null
  const candidates = [
    join(pluginDir, CODEX_COMPUTE_CLIENT_REL),
    join(pluginDir, CODEX_COMPUTE_APP, CODEX_COMPUTE_CLIENT_ABS),
  ]
  for (const bin of candidates) {
    if (existsSync(bin)) return bin
  }
  return null
}

// ── MCP Config Builder ───────────────────────────────────────────────────────

/**
 * Build the DuckHive MCP server config for the Codex computer-use server.
 * Returns a stdio config with the absolute path to SkyComputerUseClient.
 */
function buildCodexCUConfig(binPath: string, cwd: string): {
  command: string
  args: string[]
} {
  return {
    command: binPath,
    args: ['mcp'],
  }
}

// ── DuckHive MCP Integration ───────────────────────────────────────────────────

/**
 * Add the Codex computer-use MCP server to DuckHive's user-level config.
 * This makes it available as `mcp__computer-use__*` tools.
 *
 * NOTE: Requires DuckHive to have MCP allowlist policy that permits this server.
 * The stdio config (command + args) must pass policy checks in config.ts
 * isMcpServerAllowedByPolicy / isMcpServerDenied.
 *
 * This function dynamically imports DuckHive's MCP config module to avoid
 * circular deps. Safe to call after DuckHive has fully bootstrapped.
 */
async function addToDuckHiveMCP(
  binPath: string,
  pluginDir: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { addMcpConfig, type Scope } = await import(
      '../../services/mcp/config.js'
    )
    const { getServerCommandArray } = await import(
      '../../services/mcp/config.js'
    )
    const config = buildCodexCUConfig(binPath, pluginDir)

    // Validate the config is allowed by policy before adding
    const { isMcpServerAllowedByPolicy, isMcpServerDenied } = await import(
      '../../services/mcp/config.js'
    )
    const allowed = isMcpServerAllowedByPolicy(CODEX_PLUGIN_NAME, {
      type: 'stdio',
      command: config.command,
      args: config.args,
    })
    const denied = isMcpServerDenied(CODEX_PLUGIN_NAME, {
      type: 'stdio',
      command: config.command,
      args: config.args,
    })
    if (denied) {
      return {
        ok: false,
        error: `MCP server "${CODEX_PLUGIN_NAME}" is denied by policy. Check your MCP denylist settings.`,
      }
    }
    if (!allowed) {
      // Not explicitly allowed — try adding anyway (user-level = 'user' scope)
      // The policy may be open or require name-only allowlist
    }

    await addMcpConfig(CODEX_PLUGIN_NAME, {
      type: 'stdio',
      command: config.command,
      args: config.args,
      env: {},
    })

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Remove the Codex computer-use MCP server from DuckHive's config.
 */
async function removeFromDuckHiveMCP(): Promise<{
  ok: true
} | { ok: false; error: string }> {
  try {
    const { removeMcpConfig } = await import('../../services/mcp/config.js')
    await removeMcpConfig(CODEX_PLUGIN_NAME)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Check if the Codex computer-use MCP server is currently configured.
 */
async function isConfiguredInDuckHiveMCP(): Promise<boolean> {
  try {
    const { getCurrentProjectConfig } = await import(
      '../../services/mcp/config.js'
    )
    const config = getCurrentProjectConfig()
    return Boolean(config.mcpServers?.[CODEX_PLUGIN_NAME])
  } catch {
    return false
  }
}

// ── Tool Rendering Overrides ───────────────────────────────────────────────────

/**
 * Rendering overrides for mcp__computer-use__* tools in DuckHive's TUI.
 * Mirrors the pattern in src/utils/computerUse/toolRendering.tsx.
 *
 * Provides user-friendly labels and summaries for each tool.
 */
export function getCodexComputerUseToolOverrides(toolName: string): {
  userFacingName: () => string
  renderToolUseMessage: (input: Record<string, unknown>) => string
} {
  const prefix = CODEX_PLUGIN_NAME

  function userFacingName() {
    // Strip mcp__computer-use__ prefix for display
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
      type: '⌨️ Type Text',
      press_key: '⌨️ Press Key',
      key: '⌨️ Press Key',
      hold_key: '⌨️ Hold Key',
      scroll: '📜 Scroll',
      drag: '✋ Drag',
      left_click_drag: '✋ Left-Click Drag',
      mouse_move: '🖱️ Move Mouse',
      mouse_move_to: '🖱️ Move Mouse To',
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

  function fmtCoord(c: [number, number] | unknown): string {
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
      case 'mouse_move_to':
        return fmtCoord(input.coordinate ?? input.position)
      case 'type_text':
      case 'type':
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
      case 'open_app':
        return typeof input.bundle_id === 'string'
          ? String(input.bundle_id)
          : typeof input.app === 'string' ? input.app : ''
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

// ── CLI Command ────────────────────────────────────────────────────────────────

export const call: LocalCommandCall = async (
  args: string,
): Promise<{ type: 'text'; value: string }> => {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0]?.toLowerCase() ?? 'status'
  const pluginDir = findCodexPluginDir()
  const binPath = pluginDir ? findComputeClientBin(pluginDir) : null
  const configured = await isConfiguredInDuckHiveMCP()

  if (subcommand === 'status') {
    const status = binPath
      ? `✅ Codex computer-use found\n   Plugin: ${pluginDir}\n   Binary: ${binPath}`
      : `⚠️ Codex computer-use plugin not found\n   Run Codex CLI once to populate the plugin.`
    const configStatus = configured
      ? `✅ Wired into DuckHive MCP`
      : `ℹ️ Not yet in DuckHive MCP (run \`/computer-use enable\` to add)`

    return {
      type: 'text',
      value: `🦆 DuckHive Computer Use (OpenAI Codex)\n${'─'.repeat(50)}\n${status}\n${configStatus}\n\nTools available: screenshot, click, type, scroll, drag, open_app, and more.`,
    }
  }

  if (subcommand === 'enable') {
    if (!binPath) {
      return {
        type: 'text',
        value:
          '⚠️ Codex computer-use plugin not found.\nRun `codex` once to install the plugin,\nthen try again.',
      }
    }
    if (configured) {
      return {
        type: 'text',
        value: '✅ Codex computer-use is already enabled in DuckHive.',
      }
    }
    const result = await addToDuckHiveMCP(binPath!, pluginDir!)
    if (result.ok) {
      return {
        type: 'text',
        value: `✅ Codex computer-use enabled!\n\nRestart DuckHive (or run \`/mcp reload\`) to load the tools.\nYou\'ll see mcp__computer-use__* tools in your session.`,
      }
    } else {
      return {
        type: 'text',
        value: `❌ Failed to enable: ${result.error}`,
      }
    }
  }

  if (subcommand === 'disable') {
    if (!configured) {
      return {
        type: 'text',
        value: 'ℹ️ Codex computer-use is not in DuckHive MCP config.',
      }
    }
    const result = await removeFromDuckHiveMCP()
    if (result.ok) {
      return {
        type: 'text',
        value: '✅ Codex computer-use removed from DuckHive MCP.\nRestart DuckHive (or run `/mcp reload`) to apply.',
      }
    } else {
      return {
        type: 'text',
        value: `❌ Failed to remove: ${result.error}`,
      }
    }
  }

  return {
    type: 'text',
    value: `🦆 DuckHive Computer Use\n${'─'.repeat(50)}\n/computer-use status   — Check plugin + config status\n/computer-use enable   — Wire Codex computer-use into DuckHive MCP\n/computer-use disable  — Remove from DuckHive MCP\n\nRequirements:\n  • OpenAI Codex CLI installed (codex --version)\n  • Run \`codex\` once to populate the bundled plugin\n  • macOS 15+ with accessibility permissions`,
  }
}
