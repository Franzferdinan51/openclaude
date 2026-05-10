import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  parseProviderFlag,
  applyModelFlagFromArgs,
  applyProviderFlag,
  applyProviderFlagFromArgs,
  VALID_PROVIDERS,
} from './providerFlag.js'

const ENV_KEYS = [
  'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_GEMINI',
  'CLAUDE_CODE_USE_GITHUB',
  'CLAUDE_CODE_USE_MISTRAL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENROUTER_API_KEY',
  'NVIDIA_API_KEY',
  'NVIDIA_NIM',
  'GEMINI_MODEL',
  'MISTRAL_MODEL',
  'ANTHROPIC_MODEL',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
]

const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

const RESET_KEYS = [
  'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_GEMINI',
  'CLAUDE_CODE_USE_GITHUB',
  'CLAUDE_CODE_USE_MISTRAL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENROUTER_API_KEY',
  'NVIDIA_API_KEY',
  'NVIDIA_NIM',
  'GEMINI_MODEL',
  'MISTRAL_MODEL',
  'ANTHROPIC_MODEL',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
] as const

beforeEach(() => {
  for (const key of RESET_KEYS) {
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  }
})

// --- parseProviderFlag ---

describe('parseProviderFlag', () => {
  test('returns provider name when --provider flag present', () => {
    expect(parseProviderFlag(['--provider', 'openai'])).toBe('openai')
  })

  test('returns provider name with --model alongside', () => {
    expect(parseProviderFlag(['--provider', 'gemini', '--model', 'gemini-2.0-flash'])).toBe('gemini')
  })

  test('returns null when --provider flag absent', () => {
    expect(parseProviderFlag(['--model', 'gpt-4o'])).toBeNull()
  })

  test('returns null for empty args', () => {
    expect(parseProviderFlag([])).toBeNull()
  })

  test('returns null when --provider has no value', () => {
    expect(parseProviderFlag(['--provider'])).toBeNull()
  })

  test('returns null when --provider value starts with --', () => {
    expect(parseProviderFlag(['--provider', '--model'])).toBeNull()
  })
})

// --- applyProviderFlag ---

describe('applyProviderFlag - anthropic', () => {
  test('sets no env vars for anthropic (default)', () => {
    const result = applyProviderFlag('anthropic', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_GEMINI).toBeUndefined()
  })
})

describe('applyProviderFlag - openai', () => {
  test('sets CLAUDE_CODE_USE_OPENAI=1', () => {
    const result = applyProviderFlag('openai', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBe('1')
  })

  test('sets OPENAI_MODEL when --model is provided', () => {
    applyProviderFlag('openai', ['--model', 'gpt-4o'])
    expect(process.env.OPENAI_MODEL).toBe('gpt-4o')
  })
})

describe('applyProviderFlag - kimi', () => {
  test('sets Moonshot OpenAI-compatible defaults', () => {
    const result = applyProviderFlag('kimi', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.moonshot.ai/v1')
    expect(process.env.OPENAI_MODEL).toBe('kimi-k2.6')
  })

  test('hydrates OPENAI_API_KEY from KIMI_API_KEY when present', () => {
    process.env.KIMI_API_KEY = 'sk-kimi-test'
    applyProviderFlag('kimi', [])
    expect(process.env.OPENAI_API_KEY).toBe('sk-kimi-test')
  })
})

describe('applyProviderFlag - gemini', () => {
  test('sets CLAUDE_CODE_USE_GEMINI=1', () => {
    const result = applyProviderFlag('gemini', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_GEMINI).toBe('1')
  })

  test('sets GEMINI_MODEL when --model is provided', () => {
    applyProviderFlag('gemini', ['--model', 'gemini-2.0-flash'])
    expect(process.env.GEMINI_MODEL).toBe('gemini-2.0-flash')
  })
})

describe('applyProviderFlag - github', () => {
  test('sets CLAUDE_CODE_USE_GITHUB=1', () => {
    const result = applyProviderFlag('github', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_GITHUB).toBe('1')
  })
})

describe('applyProviderFlag - bedrock', () => {
  test('sets CLAUDE_CODE_USE_BEDROCK=1', () => {
    const result = applyProviderFlag('bedrock', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe('1')
  })
})

describe('applyProviderFlag - vertex', () => {
  test('sets CLAUDE_CODE_USE_VERTEX=1', () => {
    const result = applyProviderFlag('vertex', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_VERTEX).toBe('1')
  })
})

describe('applyProviderFlag - ollama', () => {
  test('sets CLAUDE_CODE_USE_OPENAI=1 with Ollama defaults when unset', () => {
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_API_KEY

    const result = applyProviderFlag('ollama', [])
    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('http://localhost:11434/v1')
    expect(process.env.OPENAI_API_KEY).toBe('ollama')
  })

  test('sets OPENAI_MODEL when --model is provided', () => {
    applyProviderFlag('ollama', ['--model', 'llama3.2'])
    expect(process.env.OPENAI_MODEL).toBe('llama3.2')
  })

  test('does not override existing OPENAI_BASE_URL when user set a custom one', () => {
    process.env.OPENAI_BASE_URL = 'http://my-ollama:11434/v1'
    applyProviderFlag('ollama', [])
    expect(process.env.OPENAI_BASE_URL).toBe('http://my-ollama:11434/v1')
  })

  test('preserves explicit OPENAI_BASE_URL and OPENAI_API_KEY overrides', () => {
    process.env.OPENAI_BASE_URL = 'http://remote-ollama.internal:11434/v1'
    process.env.OPENAI_API_KEY = 'secret-token'

    applyProviderFlag('ollama', [])

    expect(process.env.OPENAI_BASE_URL).toBe('http://remote-ollama.internal:11434/v1')
    expect(process.env.OPENAI_API_KEY).toBe('secret-token')
  })
})

describe('applyProviderFlag - openrouter', () => {
  test('sets OpenRouter base URL, default model, and hydrates key from OPENROUTER_API_KEY', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test'

    const result = applyProviderFlag('openrouter', [])

    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1')
    expect(process.env.OPENAI_MODEL).toBe('openai/gpt-5-mini')
    expect(process.env.OPENAI_API_KEY).toBe('sk-or-test')
  })

  test('sets OPENAI_MODEL when --model is provided', () => {
    applyProviderFlag('openrouter', ['--model', 'openrouter/auto'])
    expect(process.env.OPENAI_MODEL).toBe('openrouter/auto')
  })
})

describe('applyProviderFlag - nvidia-nim', () => {
  test('sets NVIDIA NIM base URL, marker flag, and hydrates key from NVIDIA_API_KEY', () => {
    process.env.NVIDIA_API_KEY = 'nvapi-test'

    const result = applyProviderFlag('nvidia-nim', [])

    expect(result.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://integrate.api.nvidia.com/v1')
    expect(process.env.NVIDIA_NIM).toBe('1')
    expect(process.env.OPENAI_API_KEY).toBe('nvapi-test')
  })
})

describe('applyProviderFlag - invalid provider', () => {
  test('returns error for unknown provider', () => {
    const result = applyProviderFlag('unknown-provider', [])
    expect(result.error).toContain('unknown-provider')
    expect(result.error).toContain(VALID_PROVIDERS.join(', '))
  })
})

describe('applyProviderFlagFromArgs', () => {
  test('applies ollama provider and model from argv in one step', () => {
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_API_KEY

    const result = applyProviderFlagFromArgs([
      '--provider',
      'ollama',
      '--model',
      'qwen2.5:3b',
    ])

    expect(result?.error).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('http://localhost:11434/v1')
    expect(process.env.OPENAI_API_KEY).toBe('ollama')
    expect(process.env.OPENAI_MODEL).toBe('qwen2.5:3b')
  })

  test('returns undefined when --provider is absent', () => {
    expect(applyProviderFlagFromArgs(['--model', 'gpt-4o'])).toBeUndefined()
  })
})

describe('applyModelFlagFromArgs', () => {
  test('routes --model to OPENAI_MODEL for active OpenAI-compatible providers', () => {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    applyModelFlagFromArgs(['--model', 'gpt-5.4'])
    expect(process.env.OPENAI_MODEL).toBe('gpt-5.4')
  })

  test('routes --model to GEMINI_MODEL for active Gemini provider', () => {
    process.env.CLAUDE_CODE_USE_GEMINI = 'true'
    applyModelFlagFromArgs(['--model', 'gemini-2.5-pro'])
    expect(process.env.GEMINI_MODEL).toBe('gemini-2.5-pro')
  })

  test('routes --model to MISTRAL_MODEL for active Mistral provider', () => {
    process.env.CLAUDE_CODE_USE_MISTRAL = '1'
    applyModelFlagFromArgs(['--model', 'devstral-latest'])
    expect(process.env.MISTRAL_MODEL).toBe('devstral-latest')
  })

  test('routes --model to ANTHROPIC_MODEL when no third-party provider is active', () => {
    applyModelFlagFromArgs(['--model', 'claude-sonnet-4-6'])
    expect(process.env.ANTHROPIC_MODEL).toBe('claude-sonnet-4-6')
  })

  test('does not run when --provider is present', () => {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    applyModelFlagFromArgs(['--provider', 'openai', '--model', 'gpt-5.4'])
    expect(process.env.OPENAI_MODEL).toBeUndefined()
  })
})
