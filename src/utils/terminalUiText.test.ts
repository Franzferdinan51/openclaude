import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const repoRoot = join(import.meta.dir, '..', '..')

const terminalUiFiles = [
  'src/components/LogoV2/LogoV2.tsx',
  'src/components/LogoV2/ChannelsNotice.tsx',
  'src/components/StartupScreen.ts',
  'bin/duckhive',
  'src/utils/logoV2Utils.ts',
  'src/utils/statusNoticeDefinitions.tsx',
  'src/commands/plugin/BrowseMarketplace.tsx',
  'src/channels/TelegramAdapter.ts',
  'src/utils/swarm/backends/registry.ts',
  'tui/model.go',
  'tui/model/state.go',
  'tui/view.go',
]

describe('terminal UI text hygiene', () => {
  test('startup and status surfaces avoid mojibake and upstream launcher names', () => {
    for (const relativePath of terminalUiFiles) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8')

      expect(source, relativePath).not.toContain('Â')
      expect(source, relativePath).not.toContain('â')
      expect(source, relativePath).not.toContain(String.fromCharCode(0x00e2))
      if (relativePath === 'src/channels/TelegramAdapter.ts') {
        expect(source, relativePath).not.toContain(String.fromCharCode(0x2026))
      }
      if (relativePath === 'src/components/StartupScreen.ts') {
        expect(source, relativePath).not.toContain(String.fromCharCode(0x2014))
      }
      expect(source, relativePath).not.toContain('claude /logout')
      expect(source, relativePath).not.toContain('claude.ai authentication')
      expect(source, relativePath).not.toContain('openclaude /logout')
      expect(source, relativePath).not.toContain('OpenClaude')
      expect(source, relativePath).not.toContain('tmux new-session -s claude')
      expect(source, relativePath).not.toContain('claude-opus-4.6')
      expect(source, relativePath).not.toContain('v0.9.1')
    }
  })
})
