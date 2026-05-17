import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const repoRoot = join(import.meta.dir, '..', '..')

const terminalUiFiles = [
  'src/components/LogoV2/LogoV2.tsx',
  'src/utils/logoV2Utils.ts',
  'src/utils/statusNoticeDefinitions.tsx',
  'src/commands/plugin/BrowseMarketplace.tsx',
]

describe('terminal UI text hygiene', () => {
  test('startup and status surfaces avoid mojibake and upstream launcher names', () => {
    for (const relativePath of terminalUiFiles) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8')

      expect(source, relativePath).not.toContain('Â')
      expect(source, relativePath).not.toContain('â')
      expect(source, relativePath).not.toContain('claude /logout')
      expect(source, relativePath).not.toContain('openclaude /logout')
    }
  })
})
