import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let configHomeDir: string

async function importFreshCurateModule() {
  return await import(`./curate.ts?curate-test=${Date.now()}-${Math.random()}`)
}

describe('/curate command', () => {
  beforeEach(() => {
    configHomeDir = join(tmpdir(), `duckhive-curate-${Date.now()}-${Math.random()}`)
    mkdirSync(configHomeDir, { recursive: true })
    mock.module('../../utils/envUtils.js', () => ({
      getClaudeConfigHomeDir: () => configHomeDir,
    }))
  })

  afterEach(() => {
    mock.restore()
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('renders empty status as ASCII-safe terminal text', async () => {
    const { call } = await importFreshCurateModule()

    const result = await call('status', {} as never)

    expect(result.value).toContain('DuckHive Curator - No user skills found')
    expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
  })

  test('renders skill rankings and run report as ASCII-safe terminal text', async () => {
    const skillsDir = join(configHomeDir, 'skills', 'release-helper')
    mkdirSync(skillsDir, { recursive: true })
    writeFileSync(
      join(skillsDir, 'SKILL.md'),
      '---\ndescription: "A reliable release readiness helper skill"\n---\n\n# Release Helper\n\n'.repeat(20),
    )
    const { call } = await importFreshCurateModule()

    const status = await call('status', {} as never)
    const run = await call('run', {} as never)

    expect(status.value).toContain('Skill Library (1 skills)')
    expect(status.value).toContain('[A] release-helper')
    expect(run.value).toContain('Curation Complete')
    expect(run.value).toContain('Full report:')
    expect(/[^\x00-\x7F]/.test(`${status.value}\n${run.value}`)).toBe(false)
  })

  test('renders unknown subcommand usage as ASCII-safe terminal text', async () => {
    const { call } = await importFreshCurateModule()

    const result = await call('unknown', {} as never)

    expect(result.value).toContain('Unknown subcommand: unknown')
    expect(result.value).toContain('/curate status')
    expect(/[^\x00-\x7F]/.test(result.value)).toBe(false)
  })
})
