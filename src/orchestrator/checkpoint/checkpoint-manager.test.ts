import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CheckpointManager } from './checkpoint-manager.ts'

let configHomeDir: string

describe('CheckpointManager', () => {
  beforeEach(() => {
    configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-checkpoint-manager-'))
  })

  afterEach(() => {
    rmSync(configHomeDir, { recursive: true, force: true })
  })

  test('uses DuckHive config home for default checkpoint storage', async () => {
    const manager = new CheckpointManager({ checkpointDir: join(configHomeDir, 'checkpoints') })

    const id = manager.save(
      'release-ready',
      [{ role: 'user', content: 'hello' }],
      { cwd: '/workspace' },
      {
        messageCount: 1,
        totalTokens: 42,
        provider: 'openai',
        model: 'gpt-test',
        tags: ['release'],
      },
    )

    const checkpoints = manager.list()
    expect(checkpoints).toHaveLength(1)
    expect(checkpoints[0]?.id).toBe(id)

    const loaded = manager.load(id)
    expect(loaded?.name).toBe('release-ready')
    expect(loaded?.metadata.model).toBe('gpt-test')
  })
})
