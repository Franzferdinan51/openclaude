import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

type LoopRecord = {
  id: string
  prompt: string
  status: string
  everyMinutes?: number
  times?: number
  remaining?: number
  nextRunAt?: string
  outputMode?: string
}

let configStore: Record<string, unknown>

async function importFreshLoopCommand() {
  return (await import(`./loop.ts?loop-test=${Date.now()}-${Math.random()}`))
    .default
}

async function importFreshLoopModule() {
  return await import(`./loop.ts?loop-test=${Date.now()}-${Math.random()}`)
}

function getStoredLoops(): LoopRecord[] {
  return ((configStore['duckhive.loops'] as LoopRecord[]) ?? [])
}

describe('/loop command', () => {
  beforeEach(() => {
    configStore = { 'duckhive.loops': [] }
    mock.module('../../utils/config.js', () => ({
      getGlobalConfig: () => configStore,
      saveGlobalConfig: (
        updater: (current: Record<string, unknown>) => Record<string, unknown>,
      ) => {
        configStore = updater(configStore)
      },
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('create stores a scheduled loop with prompt and interval metadata', async () => {
    const loopCommand = await importFreshLoopCommand()

    const result = await loopCommand([
      'create',
      '"Check deploy health"',
      '--every=15',
      '--times=3',
    ])

    expect(result).toContain('Loop created!')
    expect(result).toContain('[scheduled] **Check deploy health**')
    expect([...result].every(char => char.charCodeAt(0) < 128)).toBe(true)
    const loops = getStoredLoops()
    expect(loops).toHaveLength(1)
    expect(loops[0]?.prompt).toBe('Check deploy health')
    expect(loops[0]?.status).toBe('scheduled')
    expect(loops[0]?.everyMinutes).toBe(15)
    expect(loops[0]?.times).toBe(3)
    expect(loops[0]?.remaining).toBe(3)
  })

  test('REPL /loop create preserves escaped quotes in prompts', async () => {
    const { call } = await importFreshLoopModule()

    const result = await call('create "Check the \\"fast\\" lane" --every=15')

    expect(result.value).toContain('Loop created!')
    expect(getStoredLoops()).toHaveLength(1)
    expect(getStoredLoops()[0]?.prompt).toBe('Check the "fast" lane')
    expect(getStoredLoops()[0]?.everyMinutes).toBe(15)
  })

  test('REPL /loop create rejects unterminated quotes before storing loops', async () => {
    const { call } = await importFreshLoopModule()

    const result = await call('create "unfinished loop --every=15')

    expect(result.value).toContain('Unterminated quoted string in /loop arguments')
    expect(getStoredLoops()).toHaveLength(0)
  })

  test('REPL /loop create accepts separated option values', async () => {
    const { call } = await importFreshLoopModule()

    const result = await call(
      'create "Review nightly build" --every 20 --times 4 --output full',
    )

    expect(result.value).toContain('Loop created!')
    expect(getStoredLoops()).toHaveLength(1)
    expect(getStoredLoops()[0]?.prompt).toBe('Review nightly build')
    expect(getStoredLoops()[0]?.everyMinutes).toBe(20)
    expect(getStoredLoops()[0]?.times).toBe(4)
    expect(getStoredLoops()[0]?.remaining).toBe(4)
    expect(getStoredLoops()[0]?.outputMode).toBe('full')
  })

  test('create rejects invalid loop options before storing loops', async () => {
    const loopCommand = await importFreshLoopCommand()

    const invalidEvery = await loopCommand(['create', 'Review', '--every', 'nope'])
    const invalidOutput = await loopCommand(['create', 'Review', '--output=verbose'])

    expect(invalidEvery).toContain('--every requires a positive integer')
    expect(invalidOutput).toContain('--output must be one of')
    expect(getStoredLoops()).toHaveLength(0)
  })

  test('list shows stored loops and active filter includes scheduled loops', async () => {
    const loopCommand = await importFreshLoopCommand()
    await loopCommand(['create', '"Watch CI"', '--every=10'])

    const result = await loopCommand(['list', 'active'])

    expect(result).toContain('Scheduled Loops')
    expect(result).toContain('Watch CI')
    expect(result).toContain('Showing 1 of 1 total')
    expect(result).toContain('[scheduled] **Watch CI**')
    expect([...result].every(char => char.charCodeAt(0) < 128)).toBe(true)
  })

  test('list rejects unknown filters instead of silently showing all loops', async () => {
    const loopCommand = await importFreshLoopCommand()
    await loopCommand(['create', 'Watch CI', '--every=10'])

    const result = await loopCommand(['list', 'mystery'])

    expect(result).toContain('Unknown loop filter')
    expect(result).toContain('all, active, scheduled, paused, completed')
  })

  test('status shows loop details by id and summary without an id', async () => {
    const loopCommand = await importFreshLoopCommand()
    await loopCommand(['create', 'Track release', '--every=10'])
    const loopId = getStoredLoops()[0]!.id

    const detail = await loopCommand(['status', loopId])
    const summary = await loopCommand(['status'])

    expect(detail).toContain('Track release')
    expect(detail).toContain(`ID: \`${loopId}\``)
    expect(summary).toContain('Loop Status Summary')
    expect(summary).toContain('Active: 1 | Paused: 0 | Total: 1')
  })

  test('status and lifecycle commands reject ambiguous partial loop ids', async () => {
    const loopCommand = await importFreshLoopCommand()
    await loopCommand(['create', 'First loop', '--every=10'])
    await loopCommand(['create', 'Second loop', '--every=20'])

    const status = await loopCommand(['status', 'loop_'])
    const pause = await loopCommand(['pause', 'loop_'])

    expect(status).toContain('Loop reference is ambiguous: loop_')
    expect(status).toContain('Matches:')
    expect(pause).toContain('Loop reference is ambiguous: loop_')
    expect(getStoredLoops().every(loop => loop.status === 'scheduled')).toBe(true)
  })

  test('pause, resume, and clear update the stored loop lifecycle', async () => {
    const loopCommand = await importFreshLoopCommand()
    await loopCommand(['create', '"Check logs"', '--every=30'])
    const createdLoop = getStoredLoops()[0]
    expect(createdLoop).toBeDefined()

    const paused = await loopCommand(['pause', createdLoop!.id])
    expect(paused).toContain('Loop paused.')
    expect(paused).toContain('[paused]')
    expect(getStoredLoops()[0]?.status).toBe('paused')

    const resumed = await loopCommand(['resume', createdLoop!.id])
    expect(resumed).toContain('Loop resumed!')
    expect(resumed).toContain('[scheduled]')
    expect(getStoredLoops()[0]?.status).toBe('scheduled')
    expect(getStoredLoops()[0]?.nextRunAt).toBeDefined()

    const cleared = await loopCommand(['clear', createdLoop!.id])
    expect(cleared).toContain('has been removed.')
    expect(getStoredLoops()).toHaveLength(0)
  })
})
