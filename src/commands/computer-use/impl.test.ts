import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  buildCodexCUConfig,
  call,
  getCodexComputerUseToolOverrides,
  hasBuiltinComputerUseRuntime,
  setComputerUseTestDeps,
} from './impl.js'
import computerUse from './index.js'
import { join } from 'path'
import type { PathLike } from 'fs'
import type { ProjectConfig } from '../../utils/config.js'

let configState: Partial<ProjectConfig>
let addMcpConfig: ReturnType<typeof mock>
let removeMcpConfig: ReturnType<typeof mock>
let pluginAvailable = false
let pluginLocation: 'bundled' | 'codex-app' = 'bundled'
let currentPlatform: ReturnType<typeof import('os').platform> = 'darwin'

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

describe('computer-use command metadata', () => {
  test('does not claim the existing desktop command alias', () => {
    expect(computerUse.aliases).toEqual(['cu', 'comput-use'])
    expect(computerUse.aliases).not.toContain('desktop')
  })
})

describe('buildCodexCUConfig', () => {
  test('builds stdio MCP config for the native client', () => {
    expect(buildCodexCUConfig('/tmp/SkyComputerUseClient')).toEqual({
      type: 'stdio',
      command: '/tmp/SkyComputerUseClient',
      args: ['mcp'],
      env: {},
    })
  })
})

describe('getCodexComputerUseToolOverrides', () => {
  test('renders stable ASCII labels and summaries', () => {
    const click = getCodexComputerUseToolOverrides('mcp__computer-use__click')
    expect(click.userFacingName()).toBe('Click')
    expect(click.renderToolUseMessage({ coordinate: [12, 34] })).toBe(
      '(12, 34)',
    )

    const drag = getCodexComputerUseToolOverrides(
      'mcp__computer-use__left_click_drag',
    )
    expect(
      drag.renderToolUseMessage({
        start_coordinate: [1, 2],
        coordinate: [3, 4],
      }),
    ).toBe('(1, 2) -> (3, 4)')
  })
})

describe('call', () => {
  beforeEach(() => {
    configState = {}
    pluginAvailable = false
    pluginLocation = 'bundled'
    currentPlatform = 'darwin'
    addMcpConfig = mock(async () => {})
    removeMcpConfig = mock(async () => {})
    setComputerUseTestDeps({
      addMcpConfig,
      cwd: () => 'C:\\repo',
      existsSync: (targetPath: PathLike) => {
        if (!pluginAvailable) return false

        const suffixes = pluginLocation === 'bundled'
          ? [
              join('packages', 'computer-use-bundle', 'computer-use', '.mcp.json'),
              join(
                'packages',
                'computer-use-bundle',
                'computer-use',
                'Codex Computer Use.app',
                'Contents',
              ),
              join(
                'packages',
                'computer-use-bundle',
                'computer-use',
                'Codex Computer Use.app',
                'Contents',
                'SharedSupport',
                'SkyComputerUseClient.app',
                'Contents',
                'MacOS',
                'SkyComputerUseClient',
              ),
            ]
          : [
              join(
                'Applications',
                'Codex.app',
                'Contents',
                'Resources',
                'plugins',
                'openai-bundled',
                'plugins',
                'computer-use',
                '.mcp.json',
              ),
              join(
                'Applications',
                'Codex.app',
                'Contents',
                'Resources',
                'plugins',
                'openai-bundled',
                'plugins',
                'computer-use',
                'Codex Computer Use.app',
                'Contents',
              ),
              join(
                'Applications',
                'Codex.app',
                'Contents',
                'Resources',
                'plugins',
                'openai-bundled',
                'plugins',
                'computer-use',
                'Codex Computer Use.app',
                'Contents',
                'SharedSupport',
                'SkyComputerUseClient.app',
                'Contents',
                'MacOS',
                'SkyComputerUseClient',
              ),
            ]

        return suffixes.some(suffix => String(targetPath).endsWith(suffix))
      },
      getCurrentProjectConfig: () => configState as ProjectConfig,
      homedir: () => 'C:\\Users\\tester',
      platform: () => currentPlatform,
      removeMcpConfig,
    })
  })

  afterEach(() => {
    setComputerUseTestDeps(null)
  })

  test('reports missing plugin cleanly in status output', async () => {
    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('DuckHive Computer Use')
    expect(result.value).toContain('Plugin not found')
    if (hasBuiltinComputerUseRuntime()) {
      expect(result.value).toContain(
        'Reserved for DuckHive built-in computer-use runtime',
      )
      expect(result.value).toContain(
        'already reserves `computer-use` for the built-in runtime',
      )
    } else {
      expect(result.value).toContain('Not in DuckHive MCP config')
      expect(result.value).toContain(
        'Install Codex.app or the local computer-use bundle first.',
      )
    }
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('enable respects the active build contract', async () => {
    pluginAvailable = true

    const result = expectTextResult(await call('enable', {} as never))

    if (hasBuiltinComputerUseRuntime()) {
      expect(result.value).toContain(
        'already reserves `computer-use` for the built-in runtime',
      )
      expect(addMcpConfig).not.toHaveBeenCalled()
    } else {
      expect(result.value).toContain('computer-use enabled.')
      expect(addMcpConfig).toHaveBeenCalledTimes(1)
    }
  })

  test('removes the MCP config when disabling an active integration', async () => {
    configState = {
      mcpServers: {
        'computer-use': {
          type: 'stdio',
          command: 'SkyComputerUseClient',
          args: ['mcp'],
        },
      },
    }

    const result = expectTextResult(await call('disable', {} as never))

    expect(result.value).toContain('computer-use removed from DuckHive MCP.')
    expect(removeMcpConfig).toHaveBeenCalledTimes(1)
    expect(removeMcpConfig).toHaveBeenCalledWith('computer-use', 'project')
  })

  test('reports already wired before trying to rediscover a missing bundle', async () => {
    configState = {
      mcpServers: {
        'computer-use': {
          type: 'stdio',
          command: 'SkyComputerUseClient',
          args: ['mcp'],
        },
      },
    }
    pluginAvailable = true

    const result = expectTextResult(await call('enable', {} as never))

    expect(result.value).toContain('already wired into DuckHive MCP')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('enable reports stale config when MCP is set but the plugin bundle is missing', async () => {
    configState = {
      mcpServers: {
        'computer-use': {
          type: 'stdio',
          command: 'SkyComputerUseClient',
          args: ['mcp'],
        },
      },
    }

    const result = expectTextResult(await call('enable', {} as never))

    expect(result.value).toContain(
      'computer-use is configured in DuckHive MCP, but the plugin bundle is currently missing',
    )
    expect(result.value).toContain('/computer-use disable')
    expect(result.value).not.toContain('already wired into DuckHive MCP')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('status reports configured-but-missing when MCP is set but the plugin bundle is gone', async () => {
    configState = {
      mcpServers: {
        'computer-use': {
          type: 'stdio',
          command: 'SkyComputerUseClient',
          args: ['mcp'],
        },
      },
    }

    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('Plugin not found')
    expect(result.value).toContain(
      'Configured in DuckHive MCP, but the plugin bundle is currently missing',
    )
    expect(result.value).toContain(
      'Restore the plugin bundle or run `/computer-use disable` to remove the stale MCP entry.',
    )
    expect(result.value).not.toContain('Auto-wired into DuckHive MCP')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('discovers the plugin from a Codex.app install path without mutating MCP config', async () => {
    pluginAvailable = true
    pluginLocation = 'codex-app'

    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain(
      join(
        'Applications',
        'Codex.app',
        'Contents',
        'Resources',
        'plugins',
        'openai-bundled',
        'plugins',
        'computer-use',
      ),
    )
    if (hasBuiltinComputerUseRuntime()) {
      expect(result.value).toContain(
        'Reserved for DuckHive built-in computer-use runtime',
      )
      expect(result.value).toContain(
        'do not wire the Codex plugin through `/computer-use enable`.',
      )
    } else {
      expect(result.value).toContain('Not in DuckHive MCP config')
      expect(result.value).toContain(
        'Run `/computer-use enable` to wire the plugin into DuckHive MCP.',
      )
    }
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('status suggests reload when the plugin is configured and present', async () => {
    pluginAvailable = true
    configState = {
      mcpServers: {
        'computer-use': {
          type: 'stdio',
          command: 'SkyComputerUseClient',
          args: ['mcp'],
        },
      },
    }

    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('Configured in DuckHive MCP')
    expect(result.value).toContain(
      'Restart DuckHive or run `/mcp reload` to activate tools.',
    )
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('reports macOS-only support on other platforms', async () => {
    currentPlatform = 'win32'

    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('requires macOS')
    expect(result.value).toContain('/desktop')
    expect(result.value).toContain('newest-desktop-control')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('rejects extra args for status', async () => {
    const result = expectTextResult(await call('status extra', {} as never))

    expect(result.value).toBe('Usage: /computer-use status')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('rejects extra args for enable', async () => {
    const result = expectTextResult(await call('enable extra', {} as never))

    expect(result.value).toBe('Usage: /computer-use enable')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('rejects extra args for disable', async () => {
    const result = expectTextResult(await call('disable extra', {} as never))

    expect(result.value).toBe('Usage: /computer-use disable')
    expect(removeMcpConfig).not.toHaveBeenCalled()
  })
})
