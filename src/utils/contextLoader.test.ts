import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, test } from 'bun:test'
import { scanDuckContextFiles } from './contextLoader.js'

describe('scanDuckContextFiles', () => {
  test('stops at the filesystem root on Windows-style paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'duckhive-context-'))
    const nested = join(root, 'one', 'two', 'three')

    try {
      const files = scanDuckContextFiles(nested)
      expect(files).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
