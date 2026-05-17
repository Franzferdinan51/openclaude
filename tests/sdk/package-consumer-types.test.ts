/**
 * Package consumer validation test.
 *
 * Ensures the packed SDK types compile correctly for a real TypeScript consumer.
 * Reproduces: npm pack → install into temp project → tsc with skipLibCheck:false.
 *
 * This catches issues like:
 * - Constructor parameter properties in .d.ts (not allowed)
 * - Missing local imports for re-exported types
 * - Self-referential type wrappers
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { execFileSync, execSync } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync, cpSync, readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const ROOT = join(import.meta.dir, '..', '..')
const SDK_DTS = join(ROOT, 'src', 'entrypoints', 'sdk.d.ts')
const CORE_TYPES_DTS = join(ROOT, 'src', 'entrypoints', 'sdk', 'coreTypes.generated.d.ts')
const HARNESS_DTS = join(ROOT, 'src', 'entrypoints', 'harness.d.ts')
const TSC_BIN = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

/** All temp dirs created during tests — cleaned up in afterAll */
const tempDirs: string[] = []

/**
 * Set up a minimal TypeScript consumer project that imports from the SDK.
 * Simulates what npm pack + install would produce.
 */
function setupConsumerProject(name: string): string {
  const tmpDir = join(ROOT, '.tmp', `sdk-consumer-${name}-${randomUUID().slice(0, 8)}`)
  tempDirs.push(tmpDir)
  mkdirSync(tmpDir, { recursive: true })

  // Create consumer tsconfig — skipLibCheck:false is critical
  writeFileSync(
    join(tmpDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    ),
  )

  // Simulate node_modules/duckhive structure.
  const pkgDir = join(tmpDir, 'node_modules', 'duckhive')
  mkdirSync(pkgDir, { recursive: true })
  mkdirSync(join(pkgDir, 'src', 'entrypoints', 'sdk'), { recursive: true })
  mkdirSync(join(pkgDir, 'dist'), { recursive: true })

  // Package.json with "exports" mapping (matches real package)
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify(
      {
        name: 'duckhive',
        version: '0.0.0-test',
        type: 'module',
        exports: {
          './package.json': './package.json',
          './dist/cli.mjs': './dist/cli.mjs',
          './sdk': {
            types: './src/entrypoints/sdk.d.ts',
            import: './dist/sdk.mjs',
          },
          './harness': {
            types: './src/entrypoints/harness.d.ts',
            import: './dist/harness.mjs',
          },
        },
      },
      null,
      2,
    ),
  )

  // Copy type files
  cpSync(SDK_DTS, join(pkgDir, 'src', 'entrypoints', 'sdk.d.ts'))
  cpSync(CORE_TYPES_DTS, join(pkgDir, 'src', 'entrypoints', 'sdk', 'coreTypes.generated.d.ts'))
  cpSync(HARNESS_DTS, join(pkgDir, 'src', 'entrypoints', 'harness.d.ts'))

  // Dummy dist file so module resolution doesn't fail
  writeFileSync(join(pkgDir, 'dist', 'sdk.mjs'), 'export {}')
  writeFileSync(join(pkgDir, 'dist', 'harness.mjs'), 'export {}')

  return tmpDir
}

/** Compile consumer.ts in the given tmpDir. Returns stdout (empty = success). */
function tsc(tmpDir: string): string {
  return execFileSync(process.execPath, [TSC_BIN, '-p', 'tsconfig.json', '--pretty', 'false'], {
    cwd: tmpDir,
    encoding: 'utf-8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

function ensureBuildArtifacts(): void {
  const distCli = join(ROOT, 'dist', 'cli.mjs')
  const distSdk = join(ROOT, 'dist', 'sdk.mjs')
  if (existsSync(distCli) && existsSync(distSdk)) return

  execSync('bun run build', {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
  })
}

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    } catch {
      // Windows EBUSY — ignore, will be cleaned on next run or reboot
    }
  }
})

// tsc compilation can be slow under CPU contention — 30s timeout per test
describe('package consumer types', () => {
  test('SDK types compile for external consumer with skipLibCheck:false', () => {
    const tmpDir = setupConsumerProject('basic')

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      [
        `import type {`,
        `  SDKMessage,`,
        `  SDKUserMessage,`,
        `  SDKResultMessage,`,
        `  SDKRateLimitError,`,
        `  QueryOptions,`,
        `  SDKSession,`,
        `} from 'duckhive/sdk'`,
        ``,
        `// Use the types so they're not unused-imports-eliminated`,
        `type _Msg = SDKMessage`,
        `type _User = SDKUserMessage`,
        `type _Result = SDKResultMessage`,
        ``,
        `// Verify SDKRateLimitError properties are accessible`,
        `declare const err: SDKRateLimitError`,
        `const _resets: number | undefined = err.resetsAt`,
        `const _rateType: string | undefined = err.rateLimitType`,
        ``,
        `// Verify session types`,
        `declare const session: SDKSession`,
        `const _messages: SDKMessage[] = session.getMessages()`,
      ].join('\n'),
    )

    expect(tsc(tmpDir)).toBe('')
  }, 30_000)

  test('SDKMessage/SDKUserMessage/SDKResultMessage are re-exported correctly', () => {
    const tmpDir = setupConsumerProject('reexports')

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      [
        `import type { SDKMessage, SDKUserMessage, SDKResultMessage } from 'duckhive/sdk'`,
        ``,
        `// Discriminated union check — if types are broken, this won't compile`,
        `function handle(msg: SDKMessage) {`,
        `  if (msg.type === 'user') {`,
        `    const u: SDKUserMessage = msg`,
        `    console.log(u.message.content)`,
        `  }`,
        `  if (msg.type === 'result') {`,
        `    const r: SDKResultMessage = msg`,
        `    console.log(r.type)`,
        `  }`,
        `}`,
      ].join('\n'),
    )

    expect(tsc(tmpDir)).toBe('')
  }, 30_000)

  test('SDKRateLimitError has resetsAt and rateLimitType as class properties', () => {
    const tmpDir = setupConsumerProject('ratelimit')

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      [
        `import { SDKRateLimitError } from 'duckhive/sdk'`,
        ``,
        `// Constructor should accept (message?, resetsAt?, rateLimitType?)`,
        `const err = new SDKRateLimitError('rate limited', 12345, 'requests')`,
        ``,
        `// Properties should be accessible on the instance`,
        `const resets: number | undefined = err.resetsAt`,
        `const rateType: string | undefined = err.rateLimitType`,
        ``,
        `console.log(resets, rateType)`,
      ].join('\n'),
    )

    expect(tsc(tmpDir)).toBe('')
  }, 30_000)

  test('agent harness types compile for external consumers', () => {
    const tmpDir = setupConsumerProject('harness')

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      [
        `import { registerAgentHarness, resolveAgentHarness, type AgentHarness } from 'duckhive/harness'`,
        ``,
        `const harness: AgentHarness = {`,
        `  id: 'fixture',`,
        `  label: 'Fixture',`,
        `  supports: () => ({ supported: true, priority: 1 }),`,
        `  runAttempt: async () => ({ status: 'completed', finalMessage: 'ok' }),`,
        `}`,
        ``,
        `registerAgentHarness(harness)`,
        `const resolved = resolveAgentHarness({ provider: 'fixture', model: 'fixture/model' })`,
        `const id: string = resolved.harness.id`,
        `console.log(id)`,
      ].join('\n'),
    )

    expect(tsc(tmpDir)).toBe('')
  }, 30_000)
})

describe('package exports resolution', () => {
  test('package.json export is defined in exports map', () => {
    // Read the package.json and verify exports structure
    const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkgJson.exports).toBeDefined()
    expect(pkgJson.exports['./package.json']).toBe('./package.json')
    expect(pkgJson.exports['./dist/cli.mjs']).toBe('./dist/cli.mjs')
    expect(pkgJson.exports['./sdk']).toBeDefined()
    expect(pkgJson.exports['./sdk'].import).toBe('./dist/sdk.mjs')
    expect(pkgJson.exports['./sdk'].types).toBe('./src/entrypoints/sdk.d.ts')
    expect(pkgJson.exports['./harness']).toBeDefined()
    expect(pkgJson.exports['./harness'].import).toBe('./dist/harness.mjs')
    expect(pkgJson.exports['./harness'].types).toBe('./src/entrypoints/harness.d.ts')
  })

  test('root export is not defined (intentionally blocked)', () => {
    // Verify that "." is not in exports map
    const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkgJson.exports['.']).toBeUndefined()
    // No main field means root import is intentionally broken
    expect(pkgJson.main).toBeUndefined()
  })

  test('exported files exist after build', () => {
    ensureBuildArtifacts()

    // Verify the files referenced in exports exist
    expect(existsSync(join(ROOT, 'package.json'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist', 'cli.mjs'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist', 'sdk.mjs'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist', 'harness.mjs'))).toBe(true)
    expect(existsSync(join(ROOT, 'src', 'entrypoints', 'sdk.d.ts'))).toBe(true)
    expect(existsSync(join(ROOT, 'src', 'entrypoints', 'sdk', 'coreTypes.generated.d.ts'))).toBe(true)
    expect(existsSync(join(ROOT, 'src', 'entrypoints', 'harness.d.ts'))).toBe(true)
  })
})
