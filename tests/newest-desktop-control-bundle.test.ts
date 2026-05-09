import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const skillDir = join(root, 'skills', 'newest-desktop-control')

describe('newest-desktop-control bundled gateway', () => {
  test('ships the executable MCP gateway source that mcporter config points at', () => {
    const config = JSON.parse(readFileSync(join(root, 'config', 'mcporter.json'), 'utf8'))
    const serverArg = config.mcpServers['newest-desktop-control'].args[0]

    expect(serverArg).toBe('${SKILL_DIR}/newest-desktop-control/src/server.js')
    expect(existsSync(join(skillDir, 'src', 'server.js'))).toBe(true)
    expect(existsSync(join(skillDir, 'src', 'tools.js'))).toBe(true)
    expect(existsSync(join(skillDir, 'scripts', 'pyautogui_action.py'))).toBe(true)
  })

  test('package files include the bundled gateway and config', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

    expect(pkg.files).toContain('config/')
    expect(pkg.files).toContain('skills/newest-desktop-control/')
  })

  test('gateway registry exposes desktop, Android, diagnostics, and compatibility aliases', async () => {
    const { createToolRegistry } = await import('../skills/newest-desktop-control/src/tools.js')
    const registry = createToolRegistry()
    const names = registry.listTools().tools.map((tool: { name: string }) => tool.name)

    for (const name of [
      'desktop_screenshot',
      'desktop_terminal',
      'desktop_file_read',
      'android_devices',
      'android_current_activity',
      'backend_status',
      'codex_mcp_config',
      'permissions_check',
      'screenshot',
      'keyboard',
      'computer_use_screenshot',
      'computer_use_mouse_click',
    ]) {
      expect(names).toContain(name)
    }
  })
})
