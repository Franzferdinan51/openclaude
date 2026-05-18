import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  MemPalaceTool,
  getMemPalaceToolDir,
  setMemPalaceToolTestDeps,
} from './MemPalaceTool.js'

let configHomeDir: string

describe('MemPalaceTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-mempalace-tool-'))
  })

  afterEach(() => {
    setMemPalaceToolTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('uses DuckHive config home for the palace path', async () => {
    const commands: string[] = []
    setMemPalaceToolTestDeps({
      getClaudeConfigHomeDir: () => configHomeDir,
      exec: (command: string) => {
        commands.push(command)
        return 'mempalace 1.0.0'
      },
    })

    const result = await MemPalaceTool.call(
      { action: 'status' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    const palaceDir = join(configHomeDir, 'mempalace')

    expect(getMemPalaceToolDir()).toBe(palaceDir)
    expect(result.data.success).toBe(true)
    expect(result.data.output).toContain(`Palace dir: ${palaceDir}`)
    expect(commands).toContain(
      `python3 -m mempalace --palace "${palaceDir}" --version`,
    )
  })

  test('reports MemPalace as not installed when the version check fails', async () => {
    setMemPalaceToolTestDeps({
      getClaudeConfigHomeDir: () => configHomeDir,
      exec: () => {
        throw new Error('mempalace missing')
      },
    })

    const result = await MemPalaceTool.call(
      { action: 'status' },
      {} as never,
      undefined as never,
      undefined as never,
    )

    expect(result.data.success).toBe(true)
    expect(result.data.installed).toBe(false)
    expect(result.data.output).toContain('MemPalace not installed')
  })
})
