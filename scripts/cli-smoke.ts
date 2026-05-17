import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

type SmokeCase = {
  name: string
  args: string[]
  includes: string[]
  expectedStatus?: number
}

const cliPath = resolve(process.cwd(), 'dist', 'cli.mjs')

const cases: SmokeCase[] = [
  {
    name: 'version',
    args: ['--version'],
    includes: ['DuckHive'],
  },
  {
    name: 'top-level help',
    args: ['--help'],
    includes: ['Usage: duckhive', 'runtime-doctor', '--yolo'],
  },
  {
    name: 'doctor help',
    args: ['doctor', '--help'],
    includes: [
      'Usage: duckhive doctor',
      'terminal input is not usable',
      'duckhive runtime-doctor',
    ],
  },
  {
    name: 'runtime doctor help',
    args: ['runtime-doctor', '--help'],
    includes: [
      'Usage: duckhive runtime-doctor|doctor-runtime',
      'without starting the REPL',
      '--strict-interactive',
    ],
  },
  {
    name: 'runtime doctor strict interactive failure',
    args: ['runtime-doctor', '--strict-interactive'],
    expectedStatus: 1,
    includes: [
      '[FAIL] Terminal stdio',
      'Strict interactive check failed',
    ],
  },
]

const failures: string[] = []

for (const smokeCase of cases) {
  const result = spawnSync(process.execPath, [cliPath, ...smokeCase.args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DUCKHIVE_DISABLE_STARTUP_SCREEN: '1',
    },
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const normalizedOutput = output.replace(/\s+/g, ' ')

  const expectedStatus = smokeCase.expectedStatus ?? 0
  if (result.status !== expectedStatus) {
    failures.push(
      `${smokeCase.name}: exited ${result.status ?? 'unknown'} instead of ${expectedStatus}\n${output}`,
    )
    continue
  }

  for (const expected of smokeCase.includes) {
    if (!normalizedOutput.includes(expected.replace(/\s+/g, ' '))) {
      failures.push(
        `${smokeCase.name}: missing "${expected}"\n${output}`,
      )
    }
  }
}

if (failures.length > 0) {
  console.error(`CLI smoke failed:\n${failures.join('\n\n')}`)
  process.exit(1)
}

console.log(`CLI smoke passed (${cases.length} commands).`)
