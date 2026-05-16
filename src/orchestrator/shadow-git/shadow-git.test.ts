import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createShadowGit,
  getDefaultShadowGitBaseDir,
  setShadowGitTestDeps,
} from './shadow-git.ts'

let configHomeDir: string
let projectDir: string

describe('ShadowGit', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-shadow-config-'))
    projectDir = mkdtempSync(join(tmpdir(), 'duckhive-shadow-project-'))
    setShadowGitTestDeps({ getClaudeConfigHomeDir: () => configHomeDir })
  })

  afterEach(() => {
    setShadowGitTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  test('uses DuckHive config home for the default shadow repo base dir', () => {
    expect(getDefaultShadowGitBaseDir()).toBe(join(configHomeDir, 'shadow'))
  })

  test('creates and restores checkpoints without shell-specific cp commands', () => {
    mkdirSync(join(projectDir, 'src'), { recursive: true })
    const trackedFile = join(projectDir, 'src', 'feature.txt')
    writeFileSync(trackedFile, 'version one', 'utf8')

    const shadow = createShadowGit(projectDir)
    const checkpoint = shadow.checkpoint('before risky edit', ['src/feature.txt'])
    expect(checkpoint).not.toBeNull()

    writeFileSync(trackedFile, 'version two', 'utf8')
    expect(shadow.restore(checkpoint!.id, 'src/feature.txt')).toBe(true)
    expect(readFileSync(trackedFile, 'utf8')).toBe('version one')

    const checkpoints = shadow.list()
    expect(checkpoints.length).toBeGreaterThanOrEqual(1)
    expect(checkpoints[0]?.message).toContain('before risky edit')
  })
})
