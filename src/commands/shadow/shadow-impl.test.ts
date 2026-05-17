import { afterEach, describe, expect, test } from 'bun:test'
import {
  call,
  setShadowTestDeps,
} from './shadow-impl.js'

afterEach(() => {
  setShadowTestDeps(null)
})

describe('/shadow command', () => {
  test('lists checkpoints', async () => {
    setShadowTestDeps({
      createShadowGit: () =>
        ({
          list: () => [
            {
              id: 'ckpt_1',
              timestamp: Date.UTC(2026, 0, 1),
              message: 'before refactor',
              files: [],
              commitHash: 'abc123',
              projectPath: '/repo',
            },
          ],
        }) as never,
    })

    const result = await call('list', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Shadow Git checkpoints')
    expect(result.value).toContain('ckpt_1')
    expect(result.value).toContain('before refactor')
  })

  test('creates a checkpoint', async () => {
    setShadowTestDeps({
      createShadowGit: () =>
        ({
          checkpoint: (message: string) => ({
            id: 'ckpt_2',
            timestamp: Date.UTC(2026, 0, 2),
            message,
            files: [],
            commitHash: 'def456',
            projectPath: '/repo',
          }),
        }) as never,
    })

    const result = await call('checkpoint "before provider changes"', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Shadow checkpoint created')
    expect(result.value).toContain('ckpt_2')
    expect(result.value).toContain('before provider changes')
  })

  test('preserves escaped quotes in checkpoint messages', async () => {
    let checkpointMessage = ''
    setShadowTestDeps({
      createShadowGit: () =>
        ({
          checkpoint: (message: string) => {
            checkpointMessage = message
            return {
              id: 'ckpt_quotes',
              timestamp: Date.UTC(2026, 0, 2),
              message,
              files: [],
              commitHash: 'def456',
              projectPath: '/repo',
            }
          },
        }) as never,
    })

    const result = await call('checkpoint "before \\"provider\\" changes"', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('before "provider" changes')
    expect(checkpointMessage).toBe('before "provider" changes')
  })

  test('rejects unterminated quotes before creating a checkpoint', async () => {
    let checkpointCalled = false
    setShadowTestDeps({
      createShadowGit: () =>
        ({
          checkpoint: () => {
            checkpointCalled = true
            return null
          },
        }) as never,
    })

    const result = await call('checkpoint "unfinished message', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Unterminated quoted string in /shadow arguments')
    expect(checkpointCalled).toBe(false)
  })

  test('restores a checkpoint with optional file targeting', async () => {
    let restoredFile: string | undefined
    setShadowTestDeps({
      createShadowGit: () =>
        ({
          restore: (_checkpointId: string, file?: string) => {
            restoredFile = file
            return true
          },
        }) as never,
    })

    const result = await call('restore ckpt_3 --file src/app.ts', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('Shadow checkpoint restored')
    expect(result.value).toContain('ckpt_3')
    expect(result.value).toContain('src/app.ts')
    expect(restoredFile).toBe('src/app.ts')
  })

  test('returns usage for invalid input', async () => {
    const result = await call('restore', {} as never)

    expect(result.type).toBe('text')
    if (result.type !== 'text') throw new Error('unexpected result type')
    expect(result.value).toContain('restore requires a checkpoint id')
    expect(result.value).toContain('/shadow restore')
  })
})
