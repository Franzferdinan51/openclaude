import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async (_args: string) => ({
  type: 'text',
  value: `🐚 Shell Mode

Shell mode lets you alternate between Claude Code chat and shell execution.
In shell mode, each line starting with $ is executed as a shell command.

Keybindings:
  Ctrl+X  — Toggle between chat mode and shell mode
  Ctrl+D  — Exit shell mode
  Ctrl+C  — Cancel current operation

Example session:
  You: $ls -la
  → Lists files

  You: explain this output
  → Claude explains the file listing

Shell mode toggle is available via REPL keybindings.
Configure in ~/.claude/ or use the /keybindings command.`,
})
