import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

async function importFreshDuckCustodianModule() {
  return await import(
    `./impl.ts?duckcustodian-test=${Date.now()}-${Math.random()}`
  )
}

describe('/duckcustodian command', () => {
  beforeEach(() => {
    mock.module('../../utils/config.js', () => ({
      getGlobalConfig: () => ({}),
      saveConfigWithLock: () => {},
    }))

    mock.module('../../utils/envUtils.js', () => ({
      getClaudeConfigHomeDir: () => 'C:/DuckHive',
    }))

    mock.module('../../crestodian/audit.js', () => ({
      appendDuckCustodianAuditEntry: mock(async () => {}),
      readDuckCustodianAuditEntries: mock(async () => []),
      resolveDuckCustodianAuditPath: mock(() => 'C:/DuckHive/audit.log'),
    }))

    mock.module('../../crestodian/overview.js', () => ({
      loadDuckCustodianOverview: mock(async () => ({ healthy: true })),
      formatDuckCustodianOverview: mock(() => 'overview-ready'),
    }))

    mock.module('../../crestodian/probes.js', () => ({
      probeLmStudio: mock(async () => ({ found: false, models: [] })),
      probeMmx: mock(async () => ({ found: false, command: 'mmx' })),
      probeOpenClawGateway: mock(async () => ({ reachable: false })),
    }))

    mock.module('../../memdir/lessons.js', () => ({
      getLessonsForTask: mock(() => ''),
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('routes overview through executeDuckCustodianOperation', async () => {
    const execute = mock(async () => ({
      applied: false,
      message: 'DuckCustodian overview output',
    }))

    mock.module('../../crestodian/operations.js', () => ({
      parseDuckCustodianOperation: mock(() => ({ kind: 'overview' })),
      isPersistentDuckCustodianOperation: mock(() => false),
      describeDuckCustodianOperation: mock(() => 'overview'),
      executeDuckCustodianOperation: execute,
    }))

    const { call } = await importFreshDuckCustodianModule()
    const result = await call('', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('DuckCustodian overview output')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('shows approval prompt for persistent operations without approval', async () => {
    const execute = mock(async () => ({
      applied: true,
      message: 'should not run',
    }))

    mock.module('../../crestodian/operations.js', () => ({
      parseDuckCustodianOperation: mock(() => ({
        kind: 'config-set',
        key: 'defaultModel',
        value: 'minimax/m1',
      })),
      isPersistentDuckCustodianOperation: mock(() => true),
      describeDuckCustodianOperation: mock(
        () => 'Set defaultModel to minimax/m1',
      ),
      executeDuckCustodianOperation: execute,
    }))

    const { call } = await importFreshDuckCustodianModule()
    const result = await call('config-set defaultModel minimax/m1', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('requires approval')
    expect(result.value).toContain('Set defaultModel to minimax/m1')
    expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })

  test('renders rescue mode status as ASCII-safe terminal text', async () => {
    const execute = mock(async () => ({
      applied: false,
      message: 'rescue overview',
    }))

    mock.module('../../crestodian/operations.js', () => ({
      parseDuckCustodianOperation: mock(() => ({ kind: 'overview' })),
      isPersistentDuckCustodianOperation: mock(() => false),
      describeDuckCustodianOperation: mock(() => 'overview'),
      executeDuckCustodianOperation: execute,
    }))

    const { call } = await importFreshDuckCustodianModule()
    const result = await call('--rescue overview', {} as never)

    expect(result.type).toBe('text')
    expect(result.value).toContain('DuckCustodian rescue mode')
    expect(result.value).toContain('Gateway reachable: no')
    expect(result.value).toContain('Config valid: yes')
    expect(result.value).toContain('rescue overview')
    expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
  })
})
