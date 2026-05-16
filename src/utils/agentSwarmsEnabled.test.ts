import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetGrowthBook } from '../services/analytics/growthbook.js'
import { isAgentSwarmsEnabled } from './agentSwarmsEnabled.js'

const ORIGINAL_ENV = {
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:
    process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS,
  CLAUDE_FEATURE_FLAGS_FILE: process.env.CLAUDE_FEATURE_FLAGS_FILE,
  DUCKHIVE_AGENT_TEAMS_ENABLED: process.env.DUCKHIVE_AGENT_TEAMS_ENABLED,
  USER_TYPE: process.env.USER_TYPE,
}

let tempDir: string | undefined

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  resetGrowthBook()
}

afterEach(() => {
  restoreEnv()
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

describe('isAgentSwarmsEnabled', () => {
  test('enables DuckHive agent teams by default for external users', () => {
    delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
    delete process.env.DUCKHIVE_AGENT_TEAMS_ENABLED
    delete process.env.USER_TYPE

    expect(isAgentSwarmsEnabled()).toBe(true)
  })

  test('allows an explicit DuckHive env opt-out', () => {
    process.env.DUCKHIVE_AGENT_TEAMS_ENABLED = 'false'

    expect(isAgentSwarmsEnabled()).toBe(false)
  })

  test('keeps the local killswitch effective', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'duckhive-flags-'))
    const flagsPath = join(tempDir, 'feature-flags.json')
    writeFileSync(
      flagsPath,
      JSON.stringify({ tengu_amber_flint: false }),
    )
    process.env.CLAUDE_FEATURE_FLAGS_FILE = flagsPath
    delete process.env.DUCKHIVE_AGENT_TEAMS_ENABLED
    delete process.env.USER_TYPE
    resetGrowthBook()

    expect(isAgentSwarmsEnabled()).toBe(false)
  })

  test('keeps upstream opt-in compatibility', () => {
    process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = 'true'

    expect(isAgentSwarmsEnabled()).toBe(true)
  })
})
