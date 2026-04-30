/**
 * Built-in Plugin Initialization
 *
 * Initializes built-in plugins that ship with the CLI and appear in the
 * /plugin UI for users to enable/disable.
 *
 * Not all bundled features should be built-in plugins — use this for
 * features that users should be explicitly enable/disable. For
 * features with complex setup or automatic-enabling logic, use
 * src/skills/bundled/ instead.
 *
 * To add a new built-in plugin:
 * 1. Import registerBuiltinPlugin from '../builtinPlugins.js'
 * 2. Call registerBuiltinPlugin() with the plugin definition here
 */

import { registerBuiltinPlugin } from '../builtinPlugins.js'
import { join, existsSync } from 'fs'
import { homedir } from 'os'

// ── computer-use ──────────────────────────────────────────────────────────────

/**
 * OpenAI Codex's computer-use MCP server — a native macOS desktop automation
 * plugin that exposes 32 tools (screenshot, click, type, scroll, drag,
 * open_app, request_access, and more) via the SkyComputerUseClient stdio binary.
 *
 * The plugin bundle is copied by install.js to:
 *   packages/computer-use-bundle/computer-use/
 * from:
 *   /Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/
 *
 * The .mcp.json in the bundle uses a relative binary path, which only works
 * when cwd is the plugin directory. We override mcpServers inline here with
 * an absolute path so it works from any cwd.
 */

function findComputerUseBinary(): string | null {
  const home = homedir()
  const candidates = [
    // 1. DuckHive bundled (install.js copies from Codex app → here)
    join(process.cwd(), 'packages', 'computer-use-bundle', 'computer-use',
         'Codex Computer Use.app', 'Contents', 'SharedSupport',
         'SkyComputerUseClient.app', 'Contents', 'MacOS', 'SkyComputerUseClient'),
    // 2. Codex app bundle
    '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient',
    // 3. Homebrew-installed Codex
    join(home, 'Applications', 'Codex.app', 'Contents', 'Resources', 'plugins', 'openai-bundled', 'plugins', 'computer-use',
         'Codex Computer Use.app', 'Contents', 'SharedSupport', 'SkyComputerUseClient.app', 'Contents', 'MacOS', 'SkyComputerUseClient'),
    // 4. Codex runtime-extracted cache
    join(home, '.codex', '.tmp', 'bundled-marketplaces', 'openai-bundled', 'plugins', 'computer-use',
         'Codex Computer Use.app', 'Contents', 'SharedSupport', 'SkyComputerUseClient.app', 'Contents', 'MacOS', 'SkyComputerUseClient'),
  ]

  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

function isMacOS(): boolean {
  return process.platform === 'darwin'
}

const COMPUTER_USE_BINARY = isMacOS() ? findComputerUseBinary() : null

registerBuiltinPlugin({
  name: 'computer-use',
  description:
    'OpenAI Codex computer-use — native macOS desktop automation with 32 tools ' +
    '(screenshot, click, type, scroll, drag, open_app, request_access, and more). ' +
    'Requires macOS with Accessibility permissions (System Settings → Privacy → Accessibility).',
  version: '1.0.0',

  // Only available on macOS with the binary present
  isAvailable: () => isMacOS() && COMPUTER_USE_BINARY !== null,

  // Auto-enabled when the binary exists (no user action needed)
  defaultEnabled: true,

  // Override mcpServers inline so absolute path works regardless of cwd.
  // The bundle's .mcp.json uses relative path which only works when cwd=plugin-dir.
  // We use an absolute path so it works from any working directory.
  mcpServers: COMPUTER_USE_BINARY
    ? {
        'computer-use': {
          type: 'stdio',
          command: COMPUTER_USE_BINARY,
          args: ['mcp'],
          env: {},
        },
      }
    : undefined,
})

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize built-in plugins. Called during CLI startup.
 */
export function initBuiltinPlugins(): void {
  // Built-in plugins registered above via registerBuiltinPlugin() calls.
  // This function exists to run the side-effects (registerBuiltinPlugin calls)
  // at module initialization time.
}