// @ts-nocheck
/**
 * Shadow Git Checkpointing â€” Gemini CLI inspired safety net
 * Automatically creates Git snapshots BEFORE any file modification.
 * Stored in DuckHive config home under shadow/ â€” separate from project Git.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { resolve, join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'

export interface CheckpointRef {
  id: string
  timestamp: number
  message: string
  files: string[]
  commitHash: string
  projectPath: string
}

const shadowGitDeps: {
  getClaudeConfigHomeDir: () => string
} = {
  getClaudeConfigHomeDir,
}

export function setShadowGitTestDeps(
  overrides: Partial<typeof shadowGitDeps> | null,
): void {
  Object.assign(shadowGitDeps, {
    getClaudeConfigHomeDir,
    ...(overrides ?? {}),
  })
}

export function getDefaultShadowGitBaseDir(
  configHomeDir = shadowGitDeps.getClaudeConfigHomeDir(),
): string {
  return resolve(configHomeDir, 'shadow')
}

export interface ShadowGitOptions {
  shadowBaseDir?: string
}

export class ShadowGit {
  private shadowDir: string
  private projectPath: string
  private initialized: boolean = false

  constructor(
    projectPath: string = process.cwd(),
    options: ShadowGitOptions = {},
  ) {
    const shadowBase = resolve(
      options.shadowBaseDir ?? getDefaultShadowGitBaseDir(),
    )
    this.projectPath = resolve(projectPath)
    this.shadowDir = resolve(shadowBase, this.hashPath(projectPath))
    mkdirSync(this.shadowDir, { recursive: true })
  }

  init(): boolean {
    if (this.initialized) return true
    try {
      if (!existsSync(join(this.shadowDir, '.git'))) {
        this.runGit(['init'], { cwd: this.shadowDir, stdio: 'ignore' })
        this.runGit(['config', 'user.email', 'duckhive@shadow'], {
          cwd: this.shadowDir,
          stdio: 'ignore',
        })
        this.runGit(['config', 'user.name', 'DuckHive Shadow'], {
          cwd: this.shadowDir,
          stdio: 'ignore',
        })
      }
      this.initialized = true
      return true
    } catch {
      return false
    }
  }

  checkpoint(message: string, files?: string[]): CheckpointRef | null {
    if (!this.init()) return null
    try {
      const timestamp = Date.now()
      const id = `ckpt_${timestamp}`
      const fileList: string[] = files ?? this.getChangedFiles()

      for (const file of fileList) {
        const src = resolve(this.projectPath, file)
        if (!existsSync(src)) continue
        const dest = resolve(this.shadowDir, 'files', id, file)
        mkdirSync(resolve(dest, '..'), { recursive: true })
        cpSync(src, dest, { recursive: true, force: true })
      }

      this.runGit(['add', '-A'], { cwd: this.shadowDir, stdio: 'ignore' })
      try {
        this.runGit(['commit', '-m', `${message} [${id}]`, '--allow-empty'], {
          cwd: this.shadowDir,
          stdio: 'ignore',
        })
      } catch {
        // Allow empty commits to remain valid checkpoints.
      }

      const commitHash = this.runGit(['rev-parse', 'HEAD'], {
        cwd: this.shadowDir,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim()

      return {
        id,
        timestamp,
        message,
        files: fileList,
        commitHash,
        projectPath: this.projectPath,
      }
    } catch {
      return null
    }
  }

  list(): CheckpointRef[] {
    if (!this.init()) return []
    try {
      const logs = this.runGit(['log', '--oneline', '--format=%H|%s|%ct'], {
        cwd: this.shadowDir,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      return logs
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [commitHash, message, timestamp] = line.split('|')
          const id =
            message.match(/\[(ckpt_\d+)\]/)?.[1] ?? commitHash.slice(0, 12)
          return {
            id,
            timestamp: parseInt(timestamp) * 1000,
            message: message.replace(/\[.*\]/, '').trim(),
            files: [] as string[],
            commitHash,
            projectPath: this.projectPath,
          }
        })
    } catch {
      return []
    }
  }

  restore(checkpointId: string, targetFile?: string): boolean {
    if (!this.init()) return false
    try {
      const ckptDir = resolve(this.shadowDir, 'files', checkpointId)
      if (!existsSync(ckptDir)) return false

      if (targetFile) {
        const src = resolve(ckptDir, targetFile)
        const dest = resolve(this.projectPath, targetFile)
        mkdirSync(resolve(dest, '..'), { recursive: true })
        cpSync(src, dest, { recursive: true, force: true })
        return true
      }

      this.copyTreeContents(ckptDir, this.projectPath)
      return true
    } catch {
      return false
    }
  }

  private getChangedFiles(): string[] {
    try {
      const out = this.runGit(['diff', '--name-only', 'HEAD'], {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      return out.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  private copyTreeContents(sourceDir: string, destinationDir: string): void {
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      const src = resolve(sourceDir, entry.name)
      const dest = resolve(destinationDir, entry.name)
      mkdirSync(resolve(dest, '..'), { recursive: true })
      cpSync(src, dest, { recursive: true, force: true })
    }
  }

  private runGit(
    args: string[],
    options: Parameters<typeof execFileSync>[2],
  ): string {
    return execFileSync('git', args, options)
  }

  private hashPath(p: string): string {
    let hash = 0
    for (let i = 0; i < p.length; i++) {
      hash = (hash << 5) - hash + p.charCodeAt(i)
      hash |= 0
    }
    return `proj_${Math.abs(hash).toString(36)}`
  }
}

export const createShadowGit = (path?: string, options?: ShadowGitOptions) =>
  new ShadowGit(path, options)
