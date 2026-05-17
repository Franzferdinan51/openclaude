import { afterEach, expect, test } from 'bun:test'

import {
  collectResponses,
  setSwarmVotingTestDeps,
  vote,
  type CollectedResponses,
} from './swarmVoting.js'

afterEach(() => {
  setSwarmVotingTestDeps(null)
})

test('collectResponses reads the collector mailbox and uses the latest summary per agent', async () => {
  setSwarmVotingTestDeps({
    getAgentName: () => 'team-lead',
    getTeamName: () => 'duckhive-swarm',
    readMailbox: async () => [
      {
        from: 'agent-1',
        text: '{"type":"idle_notification","summary":"older summary"}',
        timestamp: '2026-05-16T10:00:00.000Z',
        read: false,
      },
      {
        from: 'agent-1',
        text: '{"type":"idle_notification","summary":"latest summary"}',
        timestamp: '2026-05-16T11:00:00.000Z',
        read: false,
      },
      {
        from: 'agent-2',
        text: 'plain response text',
        timestamp: '2026-05-16T10:30:00.000Z',
        read: false,
      },
    ],
  })

  const responses = await collectResponses(['agent-1', 'agent-2', 'agent-3'])

  expect(responses.get('agent-1')?.text).toBe('latest summary')
  expect(responses.get('agent-2')?.text).toBe('plain response text')
  expect(responses.has('agent-3')).toBe(false)
})

test('vote uses explicit mailbox ballots when voters are provided', async () => {
  const responses: CollectedResponses = new Map([
    ['agent-1', { text: 'Response one', timestamp: 1 }],
    ['agent-2', { text: 'Response two', timestamp: 2 }],
    ['agent-3', { text: 'Response three', timestamp: 3 }],
  ])

  setSwarmVotingTestDeps({
    getAgentName: () => 'team-lead',
    getTeamName: () => 'duckhive-swarm',
    readMailbox: async () => [
      {
        from: 'voter-a',
        text: '{"type":"swarm_vote","voteFor":"agent-2"}',
        timestamp: '2026-05-16T10:00:00.000Z',
        read: false,
      },
      {
        from: 'voter-b',
        text: 'vote: agent-2',
        timestamp: '2026-05-16T10:01:00.000Z',
        read: false,
      },
      {
        from: 'voter-c',
        text: 'agent-3',
        timestamp: '2026-05-16T10:02:00.000Z',
        read: false,
      },
    ],
  })

  const result = await vote(responses, ['voter-a', 'voter-b', 'voter-c'])

  expect(result.winner).toBe('agent-2')
  expect(result.tally['agent-2']).toBe(2)
  expect(result.tally['agent-3']).toBe(1)
  expect(result.votes['voter-a']).toEqual(['agent-2'])
})

test('vote fallback casts one proxy vote per agent when no explicit ballots exist', async () => {
  const responses: CollectedResponses = new Map([
    ['agent-1', { text: 'Detailed response with steps\n1. Plan\n2. Ship', timestamp: 1 }],
    ['agent-2', { text: 'Short reply', timestamp: 2 }],
    ['agent-3', { text: 'Another short reply', timestamp: 3 }],
  ])

  setSwarmVotingTestDeps({
    getAgentName: () => 'team-lead',
    getTeamName: () => 'duckhive-swarm',
    readMailbox: async () => [],
  })

  const result = await vote(responses, ['voter-a'])

  expect(result.winner).toBe('agent-1')
  expect(result.votes['agent-2']).toEqual(['agent-1'])
  expect(result.votes['agent-3']).toEqual(['agent-1'])
  expect(result.votes['agent-1'].length).toBe(1)
})
