import { afterEach, describe, expect, mock, test } from 'bun:test'
import { HiveBridge } from './hive-bridge.js'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('HiveBridge', () => {
  test('getHealth normalizes the checked-in council server health payload', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/health')) {
        return jsonResponse({
          status: 'ok',
          timestamp: '2026-05-16T23:45:00.000Z',
          version: '3.1.0',
        })
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const health = await bridge.getHealth()

    expect(health?.status).toBe('ok')
    expect(typeof health?.timestamp).toBe('number')
    expect(health?.services).toEqual({ council: true, hiveCore: true })
    expect(health?.memory).toEqual({ used: 0, total: 0, percentage: 0 })
  })

  test('getCouncilors accepts the current council server raw array payload', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/councilors')) {
        return jsonResponse([
          { id: 'skeptic', name: 'Skeptic', role: 'critic', specialty: 'risk review' },
          { id: 'builder', name: 'Builder', role: 'architect', specialty: 'systems design' },
        ])
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const councilors = await bridge.getCouncilors()

    expect(councilors).toHaveLength(2)
    expect(councilors[0]?.name).toBe('Skeptic')
    expect(councilors[1]?.role).toBe('architect')
  })

  test('getModes prefers the live council server mode catalog', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/modes')) {
        return jsonResponse([
          { id: 'deliberation', name: 'Deliberation' },
          { id: 'swarm_coding', name: 'Swarm Coding' },
          { id: 'vision', name: 'Vision Council' },
        ])
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const modes = await bridge.getModes()

    expect(modes).toEqual(['deliberation', 'swarm_coding', 'vision'])
  })

  test('startDeliberation uses session-start plus ask on the current council server', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/session/start')) {
        expect(init?.method).toBe('POST')
        return jsonResponse({
          ok: true,
          session: {
            id: 'session-123',
            topic: 'Review auth architecture',
            mode: 'deliberation',
            messages: [],
            votes: {},
            consensus: null,
          },
        })
      }
      if (url.endsWith('/api/ask')) {
        return jsonResponse({
          question: 'Review auth architecture',
          mode: 'deliberation',
          responses: {
            technocrat: 'Prefer explicit session boundaries.',
            skeptic: 'Watch for token replay risks.',
          },
        })
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const result = await bridge.startDeliberation('Review auth architecture', 'deliberation')

    expect(result.success).toBe(true)
    expect(result.sessionId).toBe('session-123')
    expect(result.verdict).toBe('COMPLEX')
    expect(result.arguments).toEqual([
      'Prefer explicit session boundaries.',
      'Watch for token replay risks.',
    ])
    expect(result.councilors).toEqual(['technocrat', 'skeptic'])
  })

  test('getCurrentSession normalizes the live council session payload', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/session')) {
        return jsonResponse({
          id: 'session-456',
          topic: 'Ship the migration',
          mode: 'deliberation',
          messages: [{ councilor: 'speaker', content: 'Open the floor.', vote: 'yea' }],
          votes: { yea: 2, nay: 1, abstain: 0 },
          consensus: null,
        })
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const session = await bridge.getCurrentSession()

    expect(session?.id).toBe('session-456')
    expect(session?.phase).toBe('deliberation')
    expect(session?.stats).toEqual({ yeas: 2, nays: 1, abstainers: 0 })
    expect(session?.messages[0]?.content).toBe('Open the floor.')
  })

  test('team routes use the checked-in council runtime contract', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/team/spawn')) {
        expect(init?.method).toBe('POST')
        return jsonResponse({
          success: true,
          teamId: 'team-123',
          team: {
            id: 'team-123',
            name: 'Research Redis caching',
            template: 'analysis',
            status: 'active',
            roles: [{ role: 'analyst', status: 'pending' }],
            createdAt: Date.now(),
          },
        })
      }
      if (url.endsWith('/api/teams')) {
        return jsonResponse({
          teams: [
            {
              id: 'team-123',
              name: 'Research Redis caching',
              template: 'analysis',
              status: 'active',
              roles: [{ role: 'analyst', status: 'pending' }],
              createdAt: Date.now(),
            },
          ],
        })
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const spawned = await bridge.spawnTeam('Research Redis caching', 'analysis')
    const teams = await bridge.getActiveTeams()

    expect(spawned.success).toBe(true)
    expect(spawned.teamId).toBe('team-123')
    expect(teams).toHaveLength(1)
    expect(teams[0]?.template).toBe('analysis')
  })

  test('decree routes use the checked-in council runtime contract', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/decree')) {
        expect(init?.method).toBe('POST')
        return jsonResponse({
          success: true,
          decreeId: 'decree-123',
          decree: {
            id: 'decree-123',
            title: 'Secure Mode',
            content: 'Agents ask before destructive commands',
            status: 'active',
            authority: 'duckhive',
            scope: 'agent',
            priority: 'medium',
            createdAt: Date.now(),
          },
        })
      }
      if (url.endsWith('/api/decrees')) {
        return jsonResponse({
          decrees: [
            {
              id: 'decree-123',
              title: 'Secure Mode',
              content: 'Agents ask before destructive commands',
              status: 'active',
              authority: 'duckhive',
              scope: 'agent',
              priority: 'medium',
              createdAt: Date.now(),
            },
          ],
        })
      }
      if (url.endsWith('/api/decree/decree-123')) {
        return jsonResponse({
          id: 'decree-123',
          title: 'Secure Mode',
          content: 'Agents ask before destructive commands',
          status: 'active',
          authority: 'duckhive',
          scope: 'agent',
          priority: 'medium',
          createdAt: Date.now(),
        })
      }
      throw new Error(`unexpected url: ${url}`)
    }) as unknown as typeof fetch

    const bridge = new HiveBridge({ apiBase: 'http://localhost:3007', enabled: true })
    const issued = await bridge.issueDecree(
      'Secure Mode',
      'Agents ask before destructive commands',
    )
    const decrees = await bridge.getActiveDecrees()
    const decree = await bridge.getDecree('decree-123')

    expect(issued.success).toBe(true)
    expect(issued.decreeId).toBe('decree-123')
    expect(decrees).toHaveLength(1)
    expect(decree?.title).toBe('Secure Mode')
  })
})
