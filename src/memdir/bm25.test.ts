import { expect, test } from 'bun:test'
import { join } from 'path'
import { getBm25IndexPath, getBm25IndexSources } from './bm25.js'

test('uses DuckHive config home for the default BM25 index path', () => {
  expect(getBm25IndexPath('C:/DuckHive')).toBe(
    join('C:/DuckHive', 'bm25-index.json'),
  )
})

test('uses shared config-home and memory-base roots for BM25 sources', () => {
  expect(getBm25IndexSources('C:/DuckHive', 'D:/RemoteMemory')).toEqual([
    { dir: join('D:/RemoteMemory', 'memory', 'memories'), label: 'memory' },
    { dir: join('D:/RemoteMemory', 'memory'), label: 'memory-root' },
    { dir: join('C:/DuckHive', 'exports'), label: 'exports' },
    { dir: join('C:/DuckHive', 'imports'), label: 'imports' },
    { dir: join('C:/DuckHive', 'mempalace'), label: 'mempalace' },
  ])
})
