import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

type LoopRecord = {
  id: string
  prompt: string
  status: string
  everyMinutes?: number
  times?: number
  remaining?: number
  nextRunAt?: string
}

let configStore: Record<string, unknown>

async function importFreshLoopCommand() {
  return (await import(`./loop.ts?loop-test=${Date.now()}-${Math.random()}`))
    .default
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
