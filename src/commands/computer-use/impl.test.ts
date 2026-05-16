import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  buildCodexCUConfig,
  call,
  getCodexComputerUseToolOverrides,
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
    currentPlatform = 'darwin'
    addMcpConfig = mock(async () => {})
    removeMcpConfig = mock(async () => {})
    setComputerUseTestDeps({
      addMcpConfig,
      cwd: () => 'C:\\repo',
      existsSync: (targetPath: PathLike) => {
        if (!pluginAvailable) return false

        return [
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
        ].some(suffix => String(targetPath).endsWith(suffix))
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
    expect(result.value).toContain('Not in DuckHive MCP config')
  })

  test('wires the discovered plugin into MCP config on enable', async () => {
    pluginAvailable = true

    const result = expectTextResult(await call('enable', {} as never))

    expect(result.value).toContain('computer-use enabled.')
    expect(addMcpConfig).toHaveBeenCalledTimes(1)
    expect(addMcpConfig).toHaveBeenCalledWith(
      'computer-use',
      {
        type: 'stdio',
        command: join(
          'C:\\repo',
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
        args: ['mcp'],
        env: {},
      },
      'project',
    )
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

    const result = expectTextResult(await call('enable', {} as never))

    expect(result.value).toContain('already wired into DuckHive MCP')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })

  test('reports macOS-only support on other platforms', async () => {
    currentPlatform = 'win32'

    const result = expectTextResult(await call('status', {} as never))

    expect(result.value).toContain('requires macOS')
    expect(result.value).toContain('/desktop')
    expect(addMcpConfig).not.toHaveBeenCalled()
  })
})
