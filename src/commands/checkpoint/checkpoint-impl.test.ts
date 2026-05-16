import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let configHomeDir: string

async function importFreshCheckpointModule() {
  return await import(
    `./checkpoint-impl.ts?checkpoint-test=${Date.now()}-${Math.random()}`
  )
}

describe('/checkpoint command', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-checkpoint-'))
    mock.module('../../utils/envUtils.js', () => ({
      getClaudeConfigHomeDir: () => configHomeDir,
    }))
  })

  afterEach(() => {
    mock.restore()
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('saves, lists, loads, and deletes checkpoints inside the config home', async () => {
    const { call } = await importFreshCheckpointModule()

    const saved = await call('save release-ready', {} as never)
    expect(saved.type).toBe('text')
    expect(saved.value).toContain('Checkpoint saved: "release-ready"')
    expect(saved.value).toContain(join(configHomeDir, 'checkpoints', 'release-ready.json'))

    const listed = await call('list', {} as never)
    expect(listed.value).toContain('Saved Checkpoints (1)')
    expect(listed.value).toContain('release-ready')

    const loaded = await call('load release-ready', {} as never)
    expect(loaded.value).toContain('Loaded: "release-ready"')

    const deleted = await call('delete release-ready', {} as never)
    expect(deleted.value).toContain('Deleted: "release-ready"')

    const empty = await call('list', {} as never)
    expect(empty.value).toContain('No saved checkpoints.')
  })
})
