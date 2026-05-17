import { afterEach, describe, expect, test } from 'bun:test'
import { call, setSwarmTestDeps } from './swarm-impl.js'

const ASCII_ONLY = /^[\x00-\x7F]*$/

function expectTextResult(result: Awaited<ReturnType<typeof call>>) {
  expect(result.type).toBe('text')
  if (result.type !== 'text') {
    throw new Error(`expected text result, received ${result.type}`)
  }
  return result
}

describe('/swarm command', () => {
  afterEach(() => {
    setSwarmTestDeps(null)
  })

  test('renders usage and dry-run plans with ASCII-safe terminal output', async () => {
    const usage = expectTextResult(await call('', {} as never))
    const dryRun = expectTextResult(
      await call('Build API --domain=coding --count=2 --dry-run', {} as never),
    )

    expect(usage.value).toContain('Swarm Command - Parallel Agent Execution')
    expect(usage.value).toContain('duckhive swarm <task description>')
    expect(usage.value).toContain('/swarm <task description>')
    expect(dryRun.value).toContain('Swarm Execution (DRY RUN)')
    expect(dryRun.value).toContain('Agent Tasks:')
    expect(ASCII_ONLY.test(`${usage.value}\n${dryRun.value}`)).toBe(true)
  })

  test('renders execution phases and vote summary with ASCII-safe terminal output', async () => {
    setSwarmTestDeps({
      spawnTeammate: async input => ({
        data: {
          agent_id: String(input.name),
          teammate_id: String(input.name),
          name: String(input.name),
          tmux_session_name: 'test-session',
          tmux_window_name: 'test-window',
          tmux_pane_id: 'test-pane',
        },
      }),
      sleep: async () => {},
      collectResponses: async agentIds => {
        const responses = new Map()
        for (const agentId of agentIds) {
          responses.set(agentId, {
            text: `response from ${agentId}`,
            timestamp: Date.now(),
          })
        }
        return responses
      },
      runSwarmVoting: async responses => ({
        mode: 'vote',
        winner: Array.from(responses.keys())[0] ?? 'agent-1',
        tally: { [Array.from(responses.keys())[0] ?? 'agent-1']: responses.size },
        votes: Object.fromEntries(
          Array.from(responses.keys()).map(agentId => [
            agentId,
            [Array.from(responses.keys())[0] ?? 'agent-1'],
          ]),
        ),
      }),
    })

    const result = expectTextResult(
      await call('Build API --domain=coding --count=2', {} as never),
    )

    expect(result.value).toContain('SWARM PHASE: PLANNING')
    expect(result.value).toContain('VOTE RESULTS:')
    expect(result.value).toContain('SWARM APPROVED - Proceeding with implementation.')
    expect(ASCII_ONLY.test(result.value)).toBe(true)
  })
})
