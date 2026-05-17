import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractTopicFromFilename,
  getAutonomousMemoryDir,
  getAutonomousSkillsDir,
  scanMemoryTopicsAtPath,
} from './autonomousSkillCreation.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

async function makeTempMemoryDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'duckhive-memory-'))
  tempDirs.push(dir)
  return dir
}

describe('autonomous skill creation topic detection', () => {
  it('extracts repeated-topic slugs from dated memory filenames', () => {
    expect(
      extractTopicFromFilename('2026-05-10-fix-search-provider-config.md'),
    ).toBe('fix-search-provider-config')
    expect(extractTopicFromFilename('fix-search-provider-config.md')).toBeNull()
    expect(extractTopicFromFilename('2026-05-10-.md')).toBeNull()
  })

  it('counts repeated topics across memory files in a directory', async () => {
    const memoryDir = await makeTempMemoryDir()

    await writeFile(
      join(memoryDir, '2026-05-10-fix-search-provider-config.md'),
      '# memory 1',
      'utf8',
    )
    await writeFile(
      join(memoryDir, '2026-05-11-fix-search-provider-config.md'),
      '# memory 2',
      'utf8',
    )
    await writeFile(
      join(memoryDir, '2026-05-12-goal-command-workflow.md'),
      '# memory 3',
      'utf8',
    )
    await writeFile(join(memoryDir, 'notes.md'), '# ignore me', 'utf8')

    const topics = scanMemoryTopicsAtPath(memoryDir)

    expect(topics.get('fix-search-provider-config')).toBe(2)
    expect(topics.get('goal-command-workflow')).toBe(1)
    expect(topics.has('notes')).toBe(false)
  })

  it('uses DuckHive config home and shared memory base for default roots', () => {
    expect(getAutonomousSkillsDir('C:/DuckHive')).toBe(
      join('C:/DuckHive', 'skills'),
    )
    expect(getAutonomousMemoryDir('C:/DuckHive')).toBe(
      join('C:/DuckHive', 'memory'),
    )
  })
})
