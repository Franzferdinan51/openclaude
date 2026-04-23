import type { HistoryMode } from 'src/hooks/useArrowKeyHistory.js'
import type { PromptInputMode } from 'src/types/textInputTypes.js'

export type InputMode = 'bash' | 'shell' | 'prompt'

export function prependModeCharacterToInput(
  input: string,
  mode: PromptInputMode,
): string {
  switch (mode) {
    case 'bash':
      return `!${input}`
    case 'shell':
      return `shell:${input}`
    default:
      return input
  }
}

export function getModeFromInput(input: string): HistoryMode {
  if (input.startsWith('!')) {
    return 'bash'
  }
  if (input.startsWith('shell:')) {
    return 'bash' // Shell mode also uses bash history
  }
  return 'prompt'
}

export function getValueFromInput(input: string): string {
  const mode = getModeFromInput(input)
  if (mode === 'prompt') {
    return input
  }
  if (input.startsWith('shell:')) {
    return input.slice(6) // Remove 'shell:' prefix
  }
  return input.slice(1) // Remove '!' prefix
}

export function isInputModeCharacter(input: string): boolean {
  return input === '!' || input.startsWith('shell:')
}

export function getModePrefix(input: string): string | null {
  if (input.startsWith('shell:')) return 'shell:'
  if (input.startsWith('!')) return '!'
  return null
}

export function stripModePrefix(input: string): string {
  if (input.startsWith('shell:')) return input.slice(6)
  if (input.startsWith('!')) return input.slice(1)
  return input
}
