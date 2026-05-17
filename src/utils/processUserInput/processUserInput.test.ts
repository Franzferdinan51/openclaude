import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

describe('processUserInput vision routing', () => {
  beforeEach(() => {
    mock.module('src/services/analytics/index.js', () => ({
      logEvent: () => {},
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('returns a vision-capable model override when prompt content contains images', async () => {
    const { processUserInput } = await import('./processUserInput.js')

    const result = await processUserInput({
      input: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'iVBORw0KGgo=',
          },
        },
        {
          type: 'text',
          text: 'Describe this image',
        },
      ],
      mode: 'prompt',
      setToolJSX: () => {},
      context: {
        getAppState: () => ({
          toolPermissionContext: { mode: 'default' },
          sessionHooks: new Map(),
          ultraplanSessionUrl: null,
          ultraplanLaunching: false,
        }),
        setAppState: () => {},
        requestPrompt: async () => undefined,
        options: {
          commands: [],
          debug: false,
          tools: [],
          verbose: false,
          mainLoopModel: 'MiniMax-Text-01',
          thinkingConfig: { type: 'disabled' },
          mcpClients: [],
          mcpResources: {},
          ideInstallationStatus: null,
          isNonInteractiveSession: true,
          customSystemPrompt: undefined,
          appendSystemPrompt: undefined,
          agentDefinitions: { activeAgents: [], allAgents: [] },
          theme: 'dark',
          maxBudgetUsd: undefined,
        },
      } as never,
      messages: [],
      querySource: 'repl',
      skipAttachments: true,
    })

    expect(result.shouldQuery).toBe(true)
    expect(result.model).toBeString()
    expect(result.model).toContain('MiniMax-')
  })
})
