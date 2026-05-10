import { describe, expect, test } from 'bun:test'
import onboard from './commands/onboard/index.js'
import { builtInCommandNames, formatDescriptionWithSource } from './commands.js'

describe('builtInCommandNames', () => {
  test('includes the LSP command', () => {
    expect(builtInCommandNames()).toContain('lsp')
  })
})

describe('/onboard command contract', () => {
  test('loads as a local JSX command instead of a prompt expansion', async () => {
    expect(onboard.type).toBe('local-jsx')
    const module = await onboard.load()
    expect(typeof module.call).toBe('function')
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
