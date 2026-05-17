import { expect, test } from 'bun:test'
import {
  renderMessagesForExport,
  renderMessagesToJson,
  renderMessagesToMarkdown,
} from './exportRenderer.js'

const messages = [
  {
    type: 'user',
    message: {
      content: 'test prompt'
    }
  },
  {
    type: 'assistant',
    message: {
      content: [
        {
          type: 'text',
          text: 'test answer'
        },
        {
          type: 'tool_use',
          name: 'Bash',
          id: 'toolu_1'
        }
      ]
    }
  }
]

test('renders conversation as markdown sections', () => {
  const markdown = renderMessagesToMarkdown(messages)
  expect(markdown).toContain('# DuckHive Conversation Export')
  expect(markdown).toContain('## User')
  expect(markdown).toContain('test prompt')
  expect(markdown).toContain('## Assistant')
  expect(markdown).toContain('[tool_use: Bash]')
})

test('renders structured json export with schema metadata', () => {
  const parsed = JSON.parse(renderMessagesToJson(messages))
  expect(parsed.schema).toBe('duckhive.conversation-export.v1')
  expect(parsed.exportedAt).toBeString()
  expect(parsed.messages).toEqual(messages)
})

test('selects markdown and json renderers by export format', async () => {
  await expect(renderMessagesForExport(messages, [], {
    format: 'markdown'
  })).resolves.toContain('## User')
  await expect(renderMessagesForExport(messages, [], {
    format: 'json'
  })).resolves.toContain('"schema": "duckhive.conversation-export.v1"')
})
