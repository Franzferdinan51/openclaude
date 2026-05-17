import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

async function importFreshDeliberationModule() {
  return await import(
    `./deliberation-service.ts?deliberation-test=${Date.now()}-${Math.random()}`
  )
}

describe('deliberation-service', () => {
  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    mock.restore()
  })

  test('consultCouncil maps legacy standard mode to live deliberation mode', async () => {
    const startDeliberation = mock(async (_topic: string, mode: string) => {
      expect(mode).toBe('deliberation')
      return {
        success: true,
        verdict: 'PROCEED',
        consensusScore: 0.8,
        arguments: ['Looks safe'],
        councilors: ['speaker'],
        duration: 42,
      }
    })

    mock.module('../hive-bridge/hive-bridge.js', () => ({
      getHiveBridge: () => ({
        isEnabled: () => true,
        isHealthy: async () => true,
        startDeliberation,
      }),
    }))

    const { consultCouncil } = await importFreshDeliberationModule()
    const result = await consultCouncil({
      topic: 'Review this architecture',
      mode: 'standard',
    })

    expect(result.source).toBe('external')
    expect(result.verdict).toBe('PROCEED')
    expect(result.consensus).toBe(0.8)
    expect(startDeliberation).toHaveBeenCalled()
  })

  test('consultCouncil maps creative and analytical modes onto live Hive modes', async () => {
    const seenModes: string[] = []
    const startDeliberation = mock(async (_topic: string, mode: string) => {
      seenModes.push(mode)
      return {
        success: true,
        verdict: 'PROCEED',
        consensusScore: 0.7,
        arguments: [],
        councilors: [],
        duration: 10,
      }
    })

    mock.module('../hive-bridge/hive-bridge.js', () => ({
      getHiveBridge: () => ({
        isEnabled: () => true,
        isHealthy: async () => true,
        startDeliberation,
      }),
    }))

    const { consultCouncil } = await importFreshDeliberationModule()
    await consultCouncil({ topic: 'Brainstorm a UI direction', mode: 'creative' })
    await consultCouncil({ topic: 'Break down this incident', mode: 'analytical' })

    expect(seenModes).toEqual(['brainstorm', 'inquiry'])
  })

  test('safetyCheck keeps critical operations on adversarial mode', async () => {
    const startDeliberation = mock(async (_topic: string, mode: string) => {
      expect(mode).toBe('adversarial')
      return {
        success: true,
        verdict: 'CAUTION',
        consensusScore: 0.6,
        arguments: ['Double-check before proceeding'],
        councilors: ['skeptic'],
        duration: 12,
      }
    })

    mock.module('../hive-bridge/hive-bridge.js', () => ({
      getHiveBridge: () => ({
        isEnabled: () => true,
        isHealthy: async () => true,
        startDeliberation,
      }),
    }))

    const { safetyCheck } = await importFreshDeliberationModule()
    const result = await safetyCheck('drop production table', 'critical')

    expect(result.safe).toBe(true)
    expect(result.warning).toContain('Council caution')
  })
})
