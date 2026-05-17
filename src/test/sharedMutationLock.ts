import {
  acquireEnvMutex,
  releaseEnvMutex,
  type MutexAcquireOptions,
  type MutexAcquireResult,
} from '../entrypoints/sdk/shared.js'

type AcquireEnvMutex = (
  options?: MutexAcquireOptions,
) => Promise<MutexAcquireResult>

export const DEFAULT_SHARED_MUTATION_LOCK_TIMEOUT_MS = 5 * 60 * 1000

function createSharedMutationLock(
  acquire: AcquireEnvMutex,
  release: () => void,
  defaultTimeoutMs: number,
) {
  return {
    async acquireSharedMutationLock(
      scope: string,
      timeoutMs?: number,
    ): Promise<void> {
      const effectiveTimeoutMs = timeoutMs ?? defaultTimeoutMs
      const result = await acquire({ timeoutMs: effectiveTimeoutMs })

      if (!result.acquired) {
        throw new Error(
          `Timed out after ${effectiveTimeoutMs}ms acquiring shared test mutation lock for ${scope}`,
        )
      }
    },
    releaseSharedMutationLock(): void {
      release()
    },
  }
}

const sharedMutationLock = createSharedMutationLock(
  acquireEnvMutex,
  releaseEnvMutex,
  DEFAULT_SHARED_MUTATION_LOCK_TIMEOUT_MS,
)

export const acquireSharedMutationLock =
  sharedMutationLock.acquireSharedMutationLock

export function releaseSharedMutationLock(): void {
  sharedMutationLock.releaseSharedMutationLock()
}

export function createSharedMutationLockForTesting(defaultTimeoutMs = 50) {
  const queue: Array<() => void> = []
  let locked = false

  const acquire: AcquireEnvMutex = async options => {
    if (!locked) {
      locked = true
      return { acquired: true }
    }

    return new Promise(resolve => {
      let resolved = false
      let callback: () => void
      const timeoutId = setTimeout(() => {
        if (resolved) return
        resolved = true
        const index = queue.indexOf(callback)
        if (index !== -1) queue.splice(index, 1)
        resolve({ acquired: false, reason: 'timeout' })
      }, options?.timeoutMs ?? defaultTimeoutMs)

      callback = () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolve({ acquired: true })
      }

      queue.push(callback)
    })
  }

  const release = () => {
    const next = queue.shift()
    if (next) {
      next()
    } else {
      locked = false
    }
  }

  return createSharedMutationLock(acquire, release, defaultTimeoutMs)
}
