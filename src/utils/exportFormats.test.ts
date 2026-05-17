import { expect, test } from 'bun:test'
import { join } from 'path'
import {
  ensureExportFilenameExtension,
  inferExportFormatFromFilename,
  normalizeExportFormat,
  parseExportArgs,
  resolveExportFilepath,
} from './exportFormats.js'

test('normalizes export format aliases', () => {
  expect(normalizeExportFormat('txt')).toBe('text')
  expect(normalizeExportFormat('md')).toBe('markdown')
  expect(normalizeExportFormat('markdown')).toBe('markdown')
  expect(normalizeExportFormat('json')).toBe('json')
  expect(normalizeExportFormat('pdf')).toBeNull()
})

test('infers export format from filename extension', () => {
  expect(inferExportFormatFromFilename('chat.txt')).toBe('text')
  expect(inferExportFormatFromFilename('chat.markdown')).toBe('markdown')
  expect(inferExportFormatFromFilename('chat.json')).toBe('json')
  expect(inferExportFormatFromFilename('chat.zip')).toBeNull()
})

test('ensures canonical export extensions', () => {
  expect(ensureExportFilenameExtension('chat', 'text')).toBe('chat.txt')
  expect(ensureExportFilenameExtension('chat.txt', 'markdown')).toBe('chat.md')
  expect(ensureExportFilenameExtension('chat.markdown', 'markdown', {
    preserveMarkdownExtension: true
  })).toBe('chat.markdown')
  expect(ensureExportFilenameExtension('chat.md', 'json')).toBe('chat.json')
})

test('parses format flags and quoted filenames', () => {
  expect(parseExportArgs('--format markdown "daily chat.md"')).toEqual({
    format: 'markdown',
    filename: 'daily chat.md'
  })
  expect(parseExportArgs('-f json out')).toEqual({
    format: 'json',
    filename: 'out'
  })
  expect(parseExportArgs('-- --literal-name')).toEqual({
    filename: '--literal-name'
  })
})

test('reports invalid export arguments', () => {
  expect(parseExportArgs('--format').error).toContain('Missing value')
  expect(parseExportArgs('--format pdf').error).toContain('Unsupported export format')
  expect(parseExportArgs('--bad').error).toContain('Unsupported export option')
  expect(parseExportArgs('"unterminated').error).toContain('Unterminated quoted string')
})

test('resolves relative export paths from cwd and preserves absolute paths', () => {
  expect(resolveExportFilepath('C:/work', 'chat.txt')).toBe(join('C:/work', 'chat.txt'))
  expect(resolveExportFilepath('C:/work', 'C:/exports/chat.txt')).toBe('C:/exports/chat.txt')
})
