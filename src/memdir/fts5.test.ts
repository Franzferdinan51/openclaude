import { expect, test } from 'bun:test'
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
