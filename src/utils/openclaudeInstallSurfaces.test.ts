import { afterEach, expect, mock, test } from 'bun:test'
import { mkdir, rm } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'

const originalEnv = { ...process.env }
const originalMacro = (globalThis as Record<string, unknown>).MACRO

afterEach(() => {
  process.env = { ...originalEnv }
  ;(globalThis as Record<string, unknown>).MACRO = originalMacro
  mock.restore()
})

async function importFreshInstallCommand() {
  mock.module('../subagentSystem.js', () => ({
    sessions_spawn: async () => '',
  }))
  return import(`../commands/install.tsx?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshInstaller() {
  return import(`./nativeInstaller/installer.ts?ts=${Date.now()}-${Math.random()}`)
}

test('install command displays ~/.local/bin/duckhive on non-Windows', async () => {
  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath('darwin')).toBe('~/.local/bin/duckhive')
})

test('install command displays duckhive.exe path on Windows', async () => {
  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath('win32')).toBe(
    join(homedir(), '.local', 'bin', 'duckhive.exe').replace(/\//g, '\\'),
  )
})

test('PowerShell installer launcher preserves DuckHive exit codes', () => {
  const source = readFileSync(join(process.cwd(), 'scripts', 'install.ps1'), 'utf8')

  expect(source).toContain('node "$Root\\bin\\duckhive" %*')
  expect(source).toContain('exit /b %ERRORLEVEL%')
})

test('cleanupNpmInstallations removes both duckhive and legacy claude local install dirs', async () => {
  const tempHome = mkdtempSync(join(tmpdir(), 'duckhive-cleanup-'))
  ;(globalThis as Record<string, unknown>).MACRO = {
    PACKAGE_URL: 'duckhive',
  }

  mock.module('./execFileNoThrow.js', () => ({
    execFileNoThrowWithCwd: async () => ({
      code: 1,
      stderr: 'npm ERR! code E404',
    }),
  }))

  const { cleanupNpmInstallations } = await importFreshInstaller()
  const duckhiveLocal = join(tempHome, '.duckhive', 'local')
  const legacyLocal = join(tempHome, '.claude', 'local')
  await mkdir(duckhiveLocal, { recursive: true })
  await mkdir(legacyLocal, { recursive: true })

  try {
    await cleanupNpmInstallations({
      configHomeDir: join(tempHome, '.duckhive'),
      homeDir: tempHome,
    })

    await expect(rm(duckhiveLocal, { recursive: true })).rejects.toThrow()
    await expect(rm(legacyLocal, { recursive: true })).rejects.toThrow()
  } finally {
    await rm(tempHome, { recursive: true, force: true })
  }
})
