import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
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

  test('applies slash-separated duckignore path patterns on the current platform', () => {
    const root = mkdtempSync(join(tmpdir(), 'duckhive-context-'))

    try {
      mkdirSync(join(root, '.duckhive'), { recursive: true })
      writeFileSync(join(root, '.duckignore'), '.duckhive/DUCK.md\n')
      writeFileSync(join(root, '.duckhive', 'DUCK.md'), 'ignored context')

      const files = scanDuckContextFiles(join(root, 'nested'))
      expect(files.map(file => file.content)).not.toContain('ignored context')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
