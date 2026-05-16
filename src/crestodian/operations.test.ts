import { describe, expect, it } from 'bun:test'
import {
  executeDuckCustodianOperation,
  parseDuckCustodianOperation,
} from './operations.js'

describe('parseDuckCustodianOperation', () => {
  it('parses setup workspace with an optional model', () => {
    expect(
      parseDuckCustodianOperation(
        'setup workspace C:\\workspace model minimax/m1',
      ),
    ).toEqual({
      kind: 'setup-workspace',
      workspace: 'c:\\workspace',
      model: 'minimax/m1',
    })
  })

  it('parses plain setup without workspace arguments', () => {
    expect(parseDuckCustodianOperation('setup')).toEqual({ kind: 'setup' })
  })

  it('parses gateway restart distinctly from gateway status', () => {
    expect(parseDuckCustodianOperation('gateway')).toEqual({
      kind: 'gateway-status',
    })
    expect(parseDuckCustodianOperation('gateway restart')).toEqual({
      kind: 'gateway-restart',
    })
  })
})

describe('executeDuckCustodianOperation', () => {
  const baseDeps = {
    loadOverview: async () => ({}) as never,
    formatOverview: () => 'overview',
  }

  it('returns live gateway status text from wired deps', async () => {
    const result = await executeDuckCustodianOperation(
      { kind: 'gateway-status' },
      {
        ...baseDeps,
        checkGateway: async () => ({
          reachable: true,
          version: 'background socket active',
        }),
      },
      { approved: true },
    )

    expect(result.applied).toBe(false)
    expect(result.message).toContain('DuckHive gateway reachable')
    expect(result.message).toContain('background socket active')
  })

  it('requires approval before applying persistent setup-workspace operations', async () => {
    const result = await executeDuckCustodianOperation(
      { kind: 'setup-workspace', workspace: 'c:\\workspace', model: 'gpt-5' },
      {
        ...baseDeps,
        runSetup: async () => ({ ok: true, message: 'configured' }),
      },
      { approved: false },
    )

    expect(result.applied).toBe(false)
    expect(result.message).toContain('Requires approval')
    expect(result.message).toContain('Setup workspace: c:\\workspace, model: gpt-5')
  })
})
