import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const tempDirs: string[] = []
const scriptPath = join(import.meta.dir, 'postbuild-patch.mjs')

function tempBundle(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'duckhive-postbuild-patch-'))
  tempDirs.push(dir)
  const file = join(dir, 'cli.mjs')
  writeFileSync(file, contents)
  return file
}

function runPatch(file: string) {
  return Bun.spawnSync({
    cmd: ['node', scriptPath],
    env: {
      ...process.env,
      DUCKHIVE_POSTBUILD_PATCH_FILE: file,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('postbuild patch guards every known _zod crash site', () => {
  const file = tempBundle(`function isZ4Schema(s) {
  const schema = s;
  return !!schema._zod;
}
function toJSONSchema(input, _params) {
  if (input instanceof $ZodRegistry) {
  }
}
function process(schema) {
    const def = schema._zod.def;
}`)

  const result = runPatch(file)
  const output = new TextDecoder().decode(result.stdout)
  const patched = readFileSync(file, 'utf8')

  expect(result.exitCode).toBe(0)
  expect(output).toContain('Post-build patch: 3 patches applied')
  expect(patched).toContain("if (!schema || typeof schema !== 'object') return false")
  expect(patched).toContain("if (!input || typeof input !== 'object') { return null; }")
  expect(patched).toContain(
    "if (!schema || typeof schema !== 'object' || !('_zod' in schema)) { return; }",
  )
})

test('postbuild patch fails when an expected _zod crash target disappears', () => {
  const file = tempBundle(`function isZ4Schema(s) {
  const schema = s;
  return !!schema._zod;
}`)

  const result = runPatch(file)
  const errorOutput = new TextDecoder().decode(result.stderr)

  expect(result.exitCode).toBe(1)
  expect(errorOutput).toContain('Missing expected post-build patch target: toJSONSchema')
  expect(errorOutput).toContain(
    'Missing expected post-build patch target: JSONSchemaGenerator.process',
  )
})
