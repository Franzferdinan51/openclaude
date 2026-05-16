import { describe, expect, test } from 'bun:test'
import {
  builtInCommandNames,
  formatDescriptionWithSource,
} from './commands.js'
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

  test('includes the repomap command', () => {
    expect(builtInCommandNames()).toContain('repomap')
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
