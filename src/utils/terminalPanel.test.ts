import { describe, expect, test } from 'bun:test'
import { getTerminalPanelSocket } from './terminalPanel.js'

describe('terminal panel branding', () => {
  test('uses a DuckHive-owned tmux socket prefix', async () => {
    expect(getTerminalPanelSocket()).toStartWith('duckhive-panel-')
    expect(getTerminalPanelSocket()).not.toStartWith('claude-panel-')
  })
})
