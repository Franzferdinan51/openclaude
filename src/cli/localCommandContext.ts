import type { LocalJSXCommandContext } from '../types/command.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'

export function createCliLocalCommandContext(): LocalJSXCommandContext {
  return {
    messages: [],
    renderedSystemPrompt: asSystemPrompt([]),
    options: {
      querySource: 'cli',
    },
    setMessages: () => {},
    onChangeAPIKey: () => {},
  } as unknown as LocalJSXCommandContext
}
