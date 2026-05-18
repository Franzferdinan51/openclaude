import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import {
  enqueue,
  popAllEditable,
  resetCommandQueue,
} from './messageQueueManager.js'

describe('messageQueueManager', () => {
  beforeEach(() => {
    resetCommandQueue()
  })

  afterEach(() => {
    resetCommandQueue()
  })

  test('restores pasted images when queued prompt input is pulled back for editing', () => {
    enqueue({
      value: 'describe the queued image',
      preExpansionValue: 'describe the queued image',
      mode: 'prompt',
      pastedContents: {
        42: {
          id: 42,
          type: 'image',
          content: 'base64-image',
          mediaType: 'image/png',
          filename: 'chart.png',
          sourcePath: 'C:\\temp\\chart.png',
        },
      },
    })

    const result = popAllEditable('', 0)

    expect(result?.text).toBe('describe the queued image')
    expect(result?.images).toEqual([
      {
        id: 42,
        type: 'image',
        content: 'base64-image',
        mediaType: 'image/png',
        filename: 'chart.png',
        sourcePath: 'C:\\temp\\chart.png',
      },
    ])
  })

  test('hydrates embedded image blocks from queued inbound content', () => {
    const value: ContentBlockParam[] = [
      { type: 'text', text: 'inspect this inbound image' },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: 'jpeg-data',
        },
      },
    ]

    enqueue({
      value,
      preExpansionValue: 'inspect this inbound image',
      mode: 'prompt',
      skipSlashCommands: true,
    })

    const result = popAllEditable('and summarize it', 'and summarize it'.length)

    expect(result?.text).toBe('inspect this inbound image\nand summarize it')
    expect(result?.images).toEqual([
      {
        id: expect.any(Number),
        type: 'image',
        content: 'jpeg-data',
        mediaType: 'image/jpeg',
        filename: 'image1',
      },
    ])
  })
})
