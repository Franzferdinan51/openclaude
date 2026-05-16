import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  getContextToolDir,
  scanContextFiles,
  writeContextToolFile,
} from './ContextTool.ts'

let configHomeDir: string
let workspaceDir: string

describe('ContextTool', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-context-tool-config-'))
    workspaceDir = mkdtempSync(join(tmpdir(), 'duckhive-context-tool-workspace-'))
  })

  afterEach(() => {
    rmSync(configHomeDir, { recursive: true, force: true })
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  test('stores global context in DuckHive config home and merges it with workspace context', () => {
    const contextDir = getContextToolDir(configHomeDir)
    expect(contextDir).toBe(join(configHomeDir, 'context'))
    writeContextToolFile(
      join(contextDir, 'global.md'),
      'global context',
      'create',
    )
    expect(readFileSync(join(configHomeDir, 'context', 'global.md'), 'utf8')).toBe(
      'global context',
    )

    writeFileSync(join(workspaceDir, '.duckhive.md'), 'workspace context', 'utf8')

    const contexts = scanContextFiles(workspaceDir, {
      contextDir,
      homeDir: dirname(workspaceDir),
    })
    expect(contexts.map(context => context.level)).toContain('global')
    expect(contexts.map(context => context.level)).toContain('workspace')
    expect(contexts.map(context => context.content)).toContain('global context')
    expect(contexts.map(context => context.content)).toContain('workspace context')

    writeContextToolFile(
      join(contextDir, 'global.md'),
      'extra context',
      'append',
    )
    expect(readFileSync(join(configHomeDir, 'context', 'global.md'), 'utf8')).toContain(
      'extra context',
    )
  })
})
