import { afterEach, describe, expect, test } from 'bun:test'

import {
  checkCliInputMode,
  checkHarnessCommandSurfaces,
  checkOpenAIEnv,
  checkSkillHubRegistry,
  formatReachabilityFailureDetail,
} from './system-check.ts'

const originalEnv = {
  CLAUDE_CODE_USE_OPENAI: process.env.CLAUDE_CODE_USE_OPENAI,
  CLAUDE_CODE_USE_GEMINI: process.env.CLAUDE_CODE_USE_GEMINI,
  CLAUDE_CODE_USE_GITHUB: process.env.CLAUDE_CODE_USE_GITHUB,
  CLAUDE_CODE_USE_MISTRAL: process.env.CLAUDE_CODE_USE_MISTRAL,
  DUCKHIVE_PROVIDER: process.env.DUCKHIVE_PROVIDER,
  DUCKHIVE_DEFAULT_PROVIDER: process.env.DUCKHIVE_DEFAULT_PROVIDER,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  MMX_API_KEY: process.env.MMX_API_KEY,
  DUCKHIVE_CLAWHUB_REGISTRY: process.env.DUCKHIVE_CLAWHUB_REGISTRY,
  CLAWHUB_REGISTRY: process.env.CLAWHUB_REGISTRY,
}

function restoreEnv(name: keyof typeof originalEnv): void {
  const value = originalEnv[name]
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

function clearProviderEnv(): void {
  delete process.env.CLAUDE_CODE_USE_OPENAI
  delete process.env.CLAUDE_CODE_USE_GEMINI
  delete process.env.CLAUDE_CODE_USE_GITHUB
  delete process.env.CLAUDE_CODE_USE_MISTRAL
  delete process.env.DUCKHIVE_PROVIDER
  delete process.env.DUCKHIVE_DEFAULT_PROVIDER
  delete process.env.OPENAI_MODEL
  delete process.env.OPENAI_BASE_URL
  delete process.env.MINIMAX_API_KEY
  delete process.env.MMX_API_KEY
  delete process.env.DUCKHIVE_CLAWHUB_REGISTRY
  delete process.env.CLAWHUB_REGISTRY
}

afterEach(() => {
  for (const name of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
    restoreEnv(name)
  }
})

describe('formatReachabilityFailureDetail', () => {
  test('returns generic failure detail for non-codex transport', () => {
    const detail = formatReachabilityFailureDetail(
      'https://api.openai.com/v1/models',
      429,
      '{"error":"rate_limit"}',
      {
        transport: 'chat_completions',
        requestedModel: 'gpt-4o',
        resolvedModel: 'gpt-4o',
      },
    )

    expect(detail).toBe(
      'Unexpected status 429 from https://api.openai.com/v1/models. Body: {"error":"rate_limit"}',
    )
  })

  test('redacts credentials and sensitive query parameters in endpoint details', () => {
    const detail = formatReachabilityFailureDetail(
      'http://user:pass@localhost:11434/v1/models?token=abc123&mode=test',
      502,
      'bad gateway',
      {
        transport: 'chat_completions',
        requestedModel: 'llama3.1:8b',
        resolvedModel: 'llama3.1:8b',
      },
    )

    expect(detail).toBe(
      'Unexpected status 502 from http://redacted:redacted@localhost:11434/v1/models?token=redacted&mode=test. Body: bad gateway',
    )
  })

  test('adds alias/entitlement hint for codex model support 400s', () => {
    const detail = formatReachabilityFailureDetail(
      'https://chatgpt.com/backend-api/codex/responses',
      400,
      '{"detail":"The \\"gpt-5.3-codex-spark\\" model is not supported when using Codex with a ChatGPT account."}',
      {
        transport: 'codex_responses',
        requestedModel: 'codexspark',
        resolvedModel: 'gpt-5.3-codex-spark',
      },
    )

    expect(detail).toContain(
      'model alias "codexspark" resolved to "gpt-5.3-codex-spark"',
    )
    expect(detail).toContain(
      'Try "codexplan" or another entitled Codex model.',
    )
  })
})

describe('checkCliInputMode', () => {
  test('passes on Windows when readable stdin remains the default', () => {
    const result = checkCliInputMode({}, { platform: 'win32' })

    expect(result.ok).toBe(true)
    expect(result.detail).toContain('Windows-safe readable stdin')
  })

  test('fails on Windows when data stdin is forced', () => {
    const result = checkCliInputMode(
      { DUCKHIVE_USE_DATA_STDIN: '1' },
      { platform: 'win32' },
    )

    expect(result.ok).toBe(false)
    expect(result.detail).toContain('typing does not appear')
  })

  test('fails on Windows when readable stdin is disabled', () => {
    const result = checkCliInputMode(
      { DUCKHIVE_USE_READABLE_STDIN: '0' },
      { platform: 'win32' },
    )

    expect(result.ok).toBe(false)
    expect(result.detail).toContain('restore interactive typing')
  })

  test('passes on non-Windows without Windows-specific warnings', () => {
    const result = checkCliInputMode(
      { DUCKHIVE_USE_DATA_STDIN: '1' },
      { platform: 'linux' },
    )

    expect(result.ok).toBe(true)
    expect(result.detail).toBe('Readable stdin default active.')
  })
})

describe('checkOpenAIEnv', () => {
  test('reports DuckHive MiniMax provider preference instead of Anthropic mode', () => {
    clearProviderEnv()
    process.env.DUCKHIVE_PROVIDER = 'minimax'
    process.env.MINIMAX_API_KEY = 'minimax-test-key'

    const results = checkOpenAIEnv()

    expect(results[0]).toEqual({
      ok: true,
      label: 'Provider mode',
      detail: 'MiniMax provider enabled.',
    })
    expect(results.some(result => result.label.includes('MINIMAX_API_KEY'))).toBe(true)
  })

  test('keeps Anthropic mode when no DuckHive or OpenAI-compatible provider is active', () => {
    clearProviderEnv()

    expect(checkOpenAIEnv()[0]).toEqual({
      ok: true,
      label: 'Provider mode',
      detail: 'Anthropic login flow enabled (CLAUDE_CODE_USE_OPENAI is off).',
    })
  })
})

describe('checkHarnessCommandSurfaces', () => {
  test('verifies the terminal-first harness command set is registered', () => {
    const result = checkHarnessCommandSurfaces()

    expect(result.ok).toBe(true)
    expect(result.detail).toContain('goal')
    expect(result.detail).toContain('computer-use')
    expect(result.detail).toContain('channel')
    expect(result.detail).toContain('council')
    expect(result.detail).toContain('tui')
  })
})

describe('checkSkillHubRegistry', () => {
  test('reports the configured ClawHub registry and skill command availability', () => {
    clearProviderEnv()
    process.env.DUCKHIVE_CLAWHUB_REGISTRY = 'https://example.test/clawhub/'

    const result = checkSkillHubRegistry()

    expect(result.ok).toBe(true)
    expect(result.detail).toContain('https://example.test/clawhub')
    expect(result.detail).toContain('/skill search')
    expect(result.detail).toContain('install')
  })
})
