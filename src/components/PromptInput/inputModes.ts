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

export type ModeEntryDecision = {
  mode: HistoryMode
  strippedValue: string
}

/**
 * Decide whether an onChange `value` should switch the input mode (e.g.
 * `prompt` → `bash`) and what the stripped buffer value should be.
 *
 * Returns null when no mode change applies. Returns a decision otherwise so
 * callers run a single update path — no separate single-char vs multi-char
 * branches that can drift apart.
 */
export function detectModeEntry(args: {
  value: string
  prevInputLength: number
  cursorOffset: number
}): ModeEntryDecision | null {
  if (args.cursorOffset !== 0) return null
  const mode = getModeFromInput(args.value)
  if (mode === 'prompt') return null
  const isSingleCharInsertion = args.value.length === args.prevInputLength + 1
  const isMultiCharIntoEmpty = args.prevInputLength === 0
  if (!isSingleCharInsertion && !isMultiCharIntoEmpty) return null
  return { mode, strippedValue: getValueFromInput(args.value) }
}
