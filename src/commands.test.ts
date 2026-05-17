import { describe, expect, test } from 'bun:test'
import {
  builtInCommandNames,
  filterCommandsShadowingBuiltIns,
  formatDescriptionWithSource,
} from './commands.js'
import loop from './commands/loop/index.js'
import mobile from './commands/mobile/index.js'
import onboard from './commands/onboard/index.js'
import { isCommand } from './types/command.js'

describe('builtInCommandNames', () => {
  test('includes the LSP command', () => {
    expect(builtInCommandNames()).toContain('lsp')
  })

  test('includes the loop command', () => {
    expect(builtInCommandNames()).toContain('loop')
  })

  test('includes the goal command', () => {
    expect(builtInCommandNames()).toContain('goal')
    expect(builtInCommandNames()).toContain('g')
  })

  test('includes the orchestrate command', () => {
    expect(builtInCommandNames()).toContain('orchestrate')
    expect(builtInCommandNames()).toContain('orch')
    expect(builtInCommandNames()).toContain('multi')
  })

  test('includes the duckcustodian command', () => {
    expect(builtInCommandNames()).toContain('duckcustodian')
    expect(builtInCommandNames()).toContain('custodian')
  })

  test('includes the spawn command', () => {
    expect(builtInCommandNames()).toContain('spawn')
    expect(builtInCommandNames()).toContain('subagent')
    expect(builtInCommandNames()).toContain('deep-dive')
  })

  test('includes the checkpoint command', () => {
    expect(builtInCommandNames()).toContain('checkpoint')
    expect(builtInCommandNames()).toContain('snap')
    expect(builtInCommandNames()).toContain('savepoint')
  })

  test('includes the agent run command surface', () => {
    expect(builtInCommandNames()).toContain('run')
    expect(builtInCommandNames()).toContain('runs')
    expect(builtInCommandNames()).toContain('agent-run')
  })

  test('includes the connect command', () => {
    expect(builtInCommandNames()).toContain('connect')
    expect(builtInCommandNames()).toContain('telegram')
  })

  test('includes the computer-use command without shadowing desktop', () => {
    expect(builtInCommandNames()).toContain('computer-use')
    expect(builtInCommandNames()).toContain('cu')
    expect(builtInCommandNames()).toContain('comput-use')
  })

  test('includes the search-provider command', () => {
    expect(builtInCommandNames()).toContain('search-provider')
    expect(builtInCommandNames()).toContain('search')
    expect(builtInCommandNames()).toContain('web-search-provider')
  })

  test('includes the android and vision commands', () => {
    expect(builtInCommandNames()).toContain('android')
    expect(builtInCommandNames()).toContain('adb')
    expect(builtInCommandNames()).toContain('vision')
    expect(builtInCommandNames()).toContain('vision-assist')
    expect(mobile.aliases).not.toContain('android')
  })

  test('includes the router command', () => {
    expect(builtInCommandNames()).toContain('router')
    expect(builtInCommandNames()).toContain('route-model')
    expect(builtInCommandNames()).toContain('model-router')
  })

  test('includes the LM Studio setup command', () => {
    expect(builtInCommandNames()).toContain('lmstudio-init')
    expect(builtInCommandNames()).toContain('lmstudio')
    expect(builtInCommandNames()).toContain('lm-studio')
  })

  test('includes the repomap command', () => {
    expect(builtInCommandNames()).toContain('repomap')
  })

  test('includes the trusted command', () => {
    expect(builtInCommandNames()).toContain('trusted')
    expect(builtInCommandNames()).toContain('trust')
    expect(builtInCommandNames()).toContain('trustedfolders')
  })

  test('includes the channel command', () => {
    expect(builtInCommandNames()).toContain('channel')
  })

  test('includes the shadow command', () => {
    expect(builtInCommandNames()).toContain('shadow')
    expect(builtInCommandNames()).toContain('shadow-git')
  })

  test('includes the mcp-manage command', () => {
    expect(builtInCommandNames()).toContain('mcp-manage')
    expect(builtInCommandNames()).toContain('mcpm')
    expect(builtInCommandNames()).toContain('mcpg')
  })

  test('includes Hive Nation team and governance commands', () => {
    expect(builtInCommandNames()).toContain('council')
    expect(builtInCommandNames()).toContain('team')
    expect(builtInCommandNames()).toContain('swarm')
    expect(builtInCommandNames()).toContain('hive-swarm')
    expect(builtInCommandNames()).toContain('code-swarm')
    expect(builtInCommandNames()).toContain('senate')
    expect(builtInCommandNames()).toContain('decree')
    expect(builtInCommandNames()).toContain('law')
    expect(builtInCommandNames()).toContain('rule')
  })

  test('includes QOL and harness helper commands that are implemented locally', () => {
    expect(builtInCommandNames()).toContain('acp')
    expect(builtInCommandNames()).toContain('acp-server')
    expect(builtInCommandNames()).toContain('budget')
    expect(builtInCommandNames()).toContain('spend')
    expect(builtInCommandNames()).toContain('cache')
    expect(builtInCommandNames()).toContain('provider-cache')
    expect(builtInCommandNames()).toContain('export')
    expect(builtInCommandNames()).toContain('changelog')
    expect(builtInCommandNames()).toContain('curate')
    expect(builtInCommandNames()).toContain('instruct')
    expect(builtInCommandNames()).toContain('introspect')
    expect(builtInCommandNames()).toContain('mmx')
    expect(builtInCommandNames()).toContain('minimax')
    expect(builtInCommandNames()).toContain('pr-size')
    expect(builtInCommandNames()).toContain('prompt-suggest')
    expect(builtInCommandNames()).toContain('shell-mode')
    expect(builtInCommandNames()).toContain('sh')
    expect(builtInCommandNames()).toContain('skill')
    expect(builtInCommandNames()).toContain('skill-workshop')
    expect(builtInCommandNames()).toContain('tui')
    expect(builtInCommandNames()).toContain('ui')
    expect(builtInCommandNames()).toContain('yolo')
    expect(builtInCommandNames()).toContain('bypass')
  })

  test('includes onboard setup without shadowing the init command', () => {
    expect(builtInCommandNames()).toContain('onboard')
    expect(builtInCommandNames()).toContain('setup')
    expect(builtInCommandNames()).toContain('welcome')
    expect(builtInCommandNames()).toContain('init')
    expect(onboard.aliases).not.toContain('init')
  })
})

describe('isCommand', () => {
  test('rejects generated missing-module noop stubs', () => {
    function noop19() {
      return null
    }

    expect(isCommand(noop19)).toBe(false)
    expect(isCommand({ isHidden: true, name: 'stub' })).toBe(false)
  })

  test('accepts real command objects', () => {
    expect(
      isCommand({
        type: 'local',
        name: 'example',
        description: 'example command',
        supportsNonInteractive: false,
        load: async () => ({
          call: async () => ({ type: 'skip' }),
        }),
      }),
    ).toBe(true)
  })
})

describe('filterCommandsShadowingBuiltIns', () => {
  test('keeps built-in commands ahead of same-name bundled skills', () => {
    const shadowingSkill = {
      type: 'prompt',
      name: 'loop',
      source: 'builtin',
      description: 'Bundled prompt skill with the same name',
      getPromptForCommand: async () => [],
    } as any
    const uniqueSkill = {
      type: 'prompt',
      name: 'unique-skill',
      source: 'builtin',
      description: 'Non-conflicting bundled prompt skill',
      getPromptForCommand: async () => [],
    } as any

    expect(
      filterCommandsShadowingBuiltIns(
        [shadowingSkill, uniqueSkill, loop],
        [loop],
      ),
    ).toEqual([uniqueSkill, loop])
  })
})

describe('formatDescriptionWithSource', () => {
  test('returns empty text for prompt commands missing a description', () => {
    const command = {
      name: 'example',
      type: 'prompt',
      source: 'builtin',
      description: undefined,
    } as any

    expect(formatDescriptionWithSource(command)).toBe('')
  })

  test('formats plugin commands with missing description safely', () => {
    const command = {
      name: 'example',
      type: 'prompt',
      source: 'plugin',
      description: undefined,
      pluginInfo: {
        pluginManifest: {
          name: 'MyPlugin',
        },
      },
    } as any

    expect(formatDescriptionWithSource(command)).toBe('(MyPlugin) ')
  })
})
