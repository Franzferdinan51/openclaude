import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  CheckpointTool,
  getCheckpointToolDir,
  setCheckpointToolTestDeps,
} from './CheckpointTool.ts'

let tempRoot: string

describe('CheckpointTool', () => {
  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'duckhive-checkpoint-tool-'))
    setCheckpointToolTestDeps({ tmpdir: () => tempRoot })
  })

  afterEach(() => {
    setCheckpointToolTestDeps(null)
    rmSync(tempRoot, { recursive: true, force: true })
  })

  test('uses a DuckHive-owned checkpoint temp directory by default', () => {
    expect(getCheckpointToolDir()).toBe(join(tempRoot, 'duckhive-checkpoints'))
  })

  test('saves, lists, loads, and auto-creates checkpoints', async () => {
    const saved = await CheckpointTool.call(
      { action: 'save', name: 'release-ready', note: 'manual save' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(saved.data.success).toBe(true)
    expect(saved.data.checkpointId).toBe('release-ready')

    const listed = await CheckpointTool.call(
      { action: 'list' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(listed.data.checkpoints?.some(c => c.id === 'release-ready')).toBe(
      true,
    )

    const loaded = await CheckpointTool.call(
      { action: 'load', id: 'release-ready' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(loaded.data.success).toBe(true)

    const auto = await CheckpointTool.call(
      { action: 'auto', note: 'milestone' },
      {} as never,
      undefined as never,
      undefined as never,
    )
    expect(auto.data.success).toBe(true)
    expect(auto.data.checkpointId).toStartWith('auto_')
  })
})
