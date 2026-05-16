import React from 'react'
import { describe, expect, it } from 'bun:test'
import { Text } from '../ink.js'
import { AppStateProvider } from '../state/AppState.tsx'
import { getDefaultAppState } from '../state/AppStateStore.ts'
import { renderToString } from '../utils/staticRender.tsx'
import {
  CoordinatorTaskPanel,
  countVisibleAgentTasks,
  getVisibleAgentTasks,
  useCoordinatorTaskCount,
} from './CoordinatorAgentStatus.tsx'
import { shouldHideTasksFooter } from './tasks/taskStatusUtils.tsx'

function makeLocalAgentTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    type: 'local_agent',
    status: 'running',
    startTime: 100,
    endTime: undefined,
    agentId: 'agent-1',
    prompt: 'do the thing',
    agentType: 'worker',
    description: 'Inspect the build',
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    pendingMessages: [],
    retain: false,
    diskLoaded: false,
    ...overrides,
  } as any
}

function makeTeammateTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mate-1',
    type: 'in_process_teammate',
    status: 'running',
    isBackgrounded: true,
    identity: {
      agentName: 'researcher',
      color: 'cyan',
    },
    isIdle: false,
    ...overrides,
  } as any
}

describe('CoordinatorAgentStatus', () => {
  it('filters visible coordinator tasks to non-main-session local agents', () => {
    const tasks = {
      'agent-2': makeLocalAgentTask({
        id: 'agent-2',
        agentId: 'agent-2',
        startTime: 200,
        description: 'Second task',
      }),
      'agent-1': makeLocalAgentTask(),
      'main-session': makeLocalAgentTask({
        id: 'main-session',
        agentId: 'main-session',
        agentType: 'main-session',
      }),
      evicted: makeLocalAgentTask({
        id: 'evicted',
        agentId: 'evicted',
        evictAfter: 0,
      }),
      teammate: makeTeammateTask(),
    }

    const visible = getVisibleAgentTasks(tasks as any)

    expect(visible.map(task => task.id)).toEqual(['agent-1', 'agent-2'])
    expect(countVisibleAgentTasks(tasks as any)).toBe(2)
  })

  it('reports coordinator task count through the hook', async () => {
    function Harness() {
      return <Text>{String(useCoordinatorTaskCount())}</Text>
    }

    const initialState = {
      ...getDefaultAppState(),
      tasks: {
        'agent-1': makeLocalAgentTask(),
        'agent-2': makeLocalAgentTask({
          id: 'agent-2',
          agentId: 'agent-2',
          startTime: 200,
        }),
      },
    }

    const output = await renderToString(
      <AppStateProvider initialState={initialState}>
        <Harness />
      </AppStateProvider>,
      100,
    )

    expect(output.trim()).toBe('2')
  })

  it('renders the coordinator task panel when visible agent rows exist', async () => {
    const initialState = {
      ...getDefaultAppState(),
      tasks: {
        'agent-1': makeLocalAgentTask(),
      },
      agentNameRegistry: new Map([['analyst', 'agent-1']]),
    }

    const output = await renderToString(
      <AppStateProvider initialState={initialState}>
        <CoordinatorTaskPanel />
      </AppStateProvider>,
      120,
    )

    expect(output).toContain('main')
    expect(output).toContain('analyst')
    expect(output).toContain('Inspect the build')
  })
})

describe('taskStatusUtils', () => {
  it('ignores panel-managed agent tasks when deciding whether to hide the tasks footer', () => {
    expect(
      shouldHideTasksFooter(
        {
          'agent-1': makeLocalAgentTask(),
        } as any,
        true,
      ),
    ).toBe(false)
  })

  it('hides the tasks footer when spinner tree owns all visible teammate tasks', () => {
    expect(
      shouldHideTasksFooter(
        {
          'mate-1': makeTeammateTask(),
        } as any,
        true,
      ),
    ).toBe(true)
  })
})
