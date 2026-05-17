import { afterEach, describe, expect, test } from 'bun:test'
import {
  call,
  setRouterTestDeps,
} from './router-impl.js'

afterEach(() => {
  setRouterTestDeps(null)
})

describe('/router command', () => {
  test('routes a task using documented key=value syntax', async () => {
    setRouterTestDeps({
      routeTask: () => ({
        provider: 'openai',
        model: 'gpt-4o',
        reason: 'Best match for complex task with vision',
        costEstimate: 0.42,
        fallback: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          contextWindow: 128000,
          costPer1MInput: 0.15,
          costPer1MOutput: 0.6,
          speed: 'fast',
          strengths: ['fast', 'cheap'],
          vision: true,
          functionCalling: true,
        },
      }),
    })

    const result = await call(
      'route "build a Flutter app" complexity=7 vision=true',
      {} as never,
    )

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Task: build a Flutter app')
    expect(result.value).toContain('Primary: openai/gpt-4o')
    expect(result.value).toContain('Fallback: openai/gpt-4o-mini')
  })

  test('lists available models', async () => {
    setRouterTestDeps({
      listModels: () => [
        {
          provider: 'minimax',
          model: 'MiniMax-M2.7',
          contextWindow: 1000000,
          costPer1MInput: 0.05,
          costPer1MOutput: 0.1,
          speed: 'fast',
          strengths: ['agents', 'reasoning'],
          vision: false,
          functionCalling: true,
        },
      ],
    })

    const result = await call('list', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Available models')
    expect(result.value).toContain('minimax/MiniMax-M2.7')
  })

  test('compares a task and shows candidate models', async () => {
    setRouterTestDeps({
      routeTask: () => ({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        reason: 'Best match for medium task',
        costEstimate: 0.33,
      }),
      listModels: () => [
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          contextWindow: 200000,
          costPer1MInput: 3,
          costPer1MOutput: 15,
          speed: 'medium',
          strengths: ['analysis', 'writing'],
          vision: true,
          functionCalling: true,
        },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          contextWindow: 128000,
          costPer1MInput: 0.15,
          costPer1MOutput: 0.6,
          speed: 'fast',
          strengths: ['fast', 'cheap'],
          vision: true,
          functionCalling: true,
        },
      ],
    })

    const result = await call(
      'compare "analyze this architecture" --complexity=5',
      {} as never,
    )

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Model compare')
    expect(result.value).toContain('Recommended: anthropic/claude-sonnet-4-20250514')
    expect(result.value).toContain('Candidates:')
  })

  test('returns usage for invalid input', async () => {
    const result = await call('route "missing bool" vision=maybe', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('vision must be true or false')
    expect(result.value).toContain('/router route')
  })
})
