import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  InitTool,
  getInitToolConfigPath,
  setInitToolTestDeps,
} from './InitTool.js'

let configHomeDir: string

describe('InitTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-init-tool-'))
    setInitToolTestDeps({ getClaudeConfigHomeDir: () => configHomeDir })
  })

  afterEach(() => {
    setInitToolTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('writes config through DuckHive config home', async () => {
    const result = await InitTool.call(
      { action: 'config', configKey: 'providers.default', configValue: 'minimax' },
      {} as never,
      undefined as never,
      undefined as never,
    )

    expect(result.data.success).toBe(true)
    expect(result.data.configUpdated).toBe(true)
    expect(getInitToolConfigPath()).toBe(join(configHomeDir, 'config.json'))
    expect(JSON.parse(readFileSync(join(configHomeDir, 'config.json'), 'utf8'))).toEqual({
      providers: { default: 'minimax' },
    })
  })
})
