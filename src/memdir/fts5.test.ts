import { expect, test } from 'bun:test'
import { spawnSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getFts5DbPath,
  getFts5MemoryDir,
  getFts5SessionsDir,
} from './fts5.js'

test('uses DuckHive config home for the default FTS5 database path', () => {
  expect(getFts5DbPath('C:/DuckHive')).toBe(join('C:/DuckHive', 'fts5.db'))
})

test('uses shared memory and session roots for FTS5 indexing', () => {
  expect(getFts5MemoryDir('D:/RemoteMemory')).toBe(
    join('D:/RemoteMemory', 'memory'),
  )
  expect(getFts5SessionsDir('C:/DuckHive')).toBe(
    join('C:/DuckHive', 'sessions'),
  )
})

test('initializes the FTS5 database inside the resolved config home', () => {
  const configHomeDir = mkdtempSync(join(tmpdir(), 'duckhive-fts5-'))
  try {
    const script = [
      "import { mock } from 'bun:test'",
      "import { writeFileSync } from 'node:fs'",
      "mock.module('better-sqlite3', () => ({ default: class Database { constructor(path) { writeFileSync(path, '') } pragma() {} exec() {} prepare() { return { all: () => [], get: () => ({ c: 0 }), run: () => undefined } } } }))",
      "const { initFts5, getFts5Stats } = await import('./src/memdir/fts5.ts')",
      'await initFts5()',
      'const stats = getFts5Stats()',
      "if (typeof stats.memoryCount !== 'number' || typeof stats.sessionCount !== 'number') process.exit(2)",
    ].join('\n')
    const result = spawnSync(process.execPath, ['--eval', script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: configHomeDir,
      },
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(existsSync(getFts5DbPath(configHomeDir))).toBe(true)
  } finally {
    rmSync(configHomeDir, { recursive: true, force: true })
  }
})
