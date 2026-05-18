/**
 * DuckHive mmx command - MiniMax CLI integration
 */
import { spawn } from 'child_process'
import { findMmx } from './findMmx.js'

const MMX_BIN = findMmx()

export async function runMmxCommand(args: string[], timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const mmx = spawn(MMX_BIN, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    const timer = setTimeout(() => {
      mmx.kill('SIGKILL')
      reject(new Error(`mmx timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    mmx.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`mmx exited with code ${code}`))
    })
    mmx.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`mmx failed to start: ${err.message}`))
    })
  })
}

export default {
  type: 'local' as const,
  name: 'mmx',
  description: 'MiniMax AI Platform - text, image, speech, music, video, vision, search',
  aliases: ['minimax'],
  supportsNonInteractive: true,
  load() {
    return import('./mmx-impl.js')
  },
}
