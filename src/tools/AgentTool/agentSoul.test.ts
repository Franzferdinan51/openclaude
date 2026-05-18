import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getSoulBaseDir,
  loadOrCreateSoul,
  saveSoul,
  setAgentSoulTestDeps,
} from './agentSoul.js'

let configHomeDir: string

describe('agent soul storage', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-agent-soul-'))
    setAgentSoulTestDeps({
      getClaudeConfigHomeDir: () => configHomeDir,
    })
  })

  afterEach(() => {
    setAgentSoulTestDeps(null)
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('stores soul files under DuckHive config home', () => {
    expect(getSoulBaseDir()).toBe(join(configHomeDir, 'agent-soul'))

    const soul = loadOrCreateSoul('research:planner')
    soul.memory.lessonsLearned.push('Prefer focused verified slices.')
    saveSoul(soul, 'research:planner')

    const soulPath = join(configHomeDir, 'agent-soul', 'research-planner', 'soul.json')
    expect(existsSync(soulPath)).toBe(true)

    const stored = JSON.parse(readFileSync(soulPath, 'utf8')) as {
      personality: { name: string }
      memory: { lessonsLearned: string[] }
    }
    expect(stored.personality.name).toBe('DuckHive Assistant')
    expect(stored.memory.lessonsLearned).toContain('Prefer focused verified slices.')
  })
})
