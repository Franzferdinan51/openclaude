import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  sessions_spawn,
  setSubagentSystemTestDeps,
} from './subagentSystem.js'

afterEach(() => {
  setSubagentSystemTestDeps(null)
})

describe('sessions_spawn', () => {
  test('routes a model automatically when no explicit model is provided', async () => {
    const routeTask = mock(() => ({
      provider: 'openai',
      model: 'gpt-4o',
      reason: 'Best match for complex task',
      costEstimate: 0.25,
    }))
    const spawnTeammate = mock(async (config: { model?: string; agent_type?: string }) => ({
      data: {
        name: 'spawned-agent',
        agent_id: 'agent-1',
        team_name: 'duckhive-sessions',
        model: config.model,
      },
    }))

    setSubagentSystemTestDeps({
      routeTask: routeTask as never,
      spawnTeammate: spawnTeammate as never,
    })

    const result = await sessions_spawn({
      agentType: 'coding',
      task: 'Implement a REST API',
      context: {} as never,
    })

    expect(routeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'coding Implement a REST API',
        functionCalling: true,
        preferQuality: true,
      }),
    )
    expect(spawnTeammate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        agent_type: 'coding',
      }),
      {} as never,
    )
    expect(result).toContain('Model: gpt-4o')
  })

  test('preserves an explicit model override', async () => {
    const routeTask = mock(() => ({
      provider: 'openai',
      model: 'gpt-4o',
      reason: 'Best match for complex task',
      costEstimate: 0.25,
    }))
    const spawnTeammate = mock(async (config: { model?: string }) => ({
      data: {
        name: 'spawned-agent',
        agent_id: 'agent-1',
        team_name: 'duckhive-sessions',
        model: config.model,
      },
    }))

    setSubagentSystemTestDeps({
      routeTask: routeTask as never,
      spawnTeammate: spawnTeammate as never,
    })

    await sessions_spawn({
      model: 'qwen3.6-35b',
      task: 'Analyze this code',
      context: {} as never,
    })

    expect(routeTask).not.toHaveBeenCalled()
    expect(spawnTeammate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen3.6-35b',
      }),
      {} as never,
    )
  })
})
