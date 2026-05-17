import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

type SmokeCase = {
  name: string
  args: string[]
  includes: string[]
  expectedStatus?: number
  env?: () => Record<string, string>
  timeoutMs?: number
}

const cliPath = resolve(process.cwd(), 'dist', 'cli.mjs')
const windowsLauncherPath = resolve(process.cwd(), 'bin', 'duckhive.cmd')
const tempDirs: string[] = []
const bgControlConfigDir = mkdtempSync(join(tmpdir(), 'duckhive-cli-smoke-bg-'))
tempDirs.push(bgControlConfigDir)

function createIsolatedConfigEnv(): Record<string, string> {
  const configDir = mkdtempSync(join(tmpdir(), 'duckhive-cli-smoke-'))
  tempDirs.push(configDir)
  return {
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS: '1',
  }
}

const cases: SmokeCase[] = [
  {
    name: 'version',
    args: ['--version'],
    includes: ['DuckHive'],
  },
  {
    name: 'yolo version alias',
    args: ['--yolo', '--version'],
    includes: ['DuckHive'],
  },
  {
    name: 'dangerously skip permissions version',
    args: ['--dangerously-skip-permissions', '--version'],
    includes: ['DuckHive'],
  },
  {
    name: 'top-level help',
    args: ['--help'],
    includes: ['Usage: duckhive', 'runtime-doctor', '--yolo', '--stdin-mode'],
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
    name: 'runtime doctor default',
    args: ['runtime-doctor'],
    includes: [
      '[PASS] CLI input mode',
      process.platform === 'win32'
        ? 'OpenClaude-compatible readable stdin is active by default'
        : 'Readable stdin default active',
    ],
  },
  {
    name: 'runtime doctor colon alias',
    args: ['doctor:runtime'],
    includes: [
      '[PASS] CLI input mode',
      process.platform === 'win32'
        ? 'OpenClaude-compatible readable stdin is active by default'
        : 'Readable stdin default active',
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
  {
    name: 'input-test help',
    args: ['input-test', '--help'],
    includes: [
      'DuckHive input-test',
      'without starting providers',
      '--stdin-mode data input-test',
    ],
  },
  {
    name: 'input-test non-interactive failure',
    args: ['input-test'],
    expectedStatus: 1,
    includes: [
      'DuckHive input-test needs stdin and stdout attached to a real terminal',
    ],
  },
  {
    name: 'background run list',
    args: ['ps'],
    includes: ['DuckHive background runs'],
  },
  {
    name: 'background spawn queues AgentRun',
    args: ['--bg', 'test prompt'],
    env: () => ({
      CLAUDE_CONFIG_DIR: bgControlConfigDir,
      CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS: '1',
    }),
    includes: [
      'Background AgentRun queued:',
      'Title: test prompt',
      'duckhive attach',
    ],
  },
  {
    name: 'background pause control',
    args: ['pause', 'latest'],
    expectedStatus: 1,
    env: () => ({
      CLAUDE_CONFIG_DIR: bgControlConfigDir,
      CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS: '1',
    }),
    includes: ['Run not found: latest'],
  },
  {
    name: 'non-interactive repl guidance',
    args: ['--dangerously-skip-permissions'],
    expectedStatus: 1,
    includes: [
      'DuckHive is running without an interactive terminal',
      'duckhive -p "<prompt>"',
      'duckhive runtime-doctor',
    ],
  },
  {
    name: 'headless goal command',
    args: ['--bare', '-p', '/goal Build smoke goal'],
    env: createIsolatedConfigEnv,
    timeoutMs: 30000,
    includes: [
      'Goal created successfully!',
      'Build smoke goal',
      'Attached Session:',
    ],
  },
  {
    name: 'top-level goal help',
    args: ['goal', '--help'],
    includes: [
      'DuckHive /goal - Persisted Workflow Goals',
      '/goal <description>',
      '/goal step add',
    ],
  },
  {
    name: 'top-level goal help after stdin-mode option',
    args: ['--stdin-mode', 'data', 'goal', '--help'],
    includes: [
      'DuckHive /goal - Persisted Workflow Goals',
      '/goal <description>',
    ],
  },
  {
    name: 'top-level goal command',
    args: ['goal', 'Build', 'top-level', 'smoke', 'goal'],
    env: createIsolatedConfigEnv,
    timeoutMs: 30000,
    includes: [
      'Goal created successfully!',
      'Build top-level smoke goal',
      'Attached Session:',
    ],
  },
  {
    name: 'top-level computer-use help',
    args: ['computer-use', '--help'],
    includes: [
      'Computer Use',
      '/computer-use status',
      'newest-desktop-control',
    ],
  },
  {
    name: 'top-level computer-use status',
    args: ['cu', 'status'],
    includes: [
      'DuckHive Computer Use',
      process.platform === 'darwin'
        ? 'Fallback gateway: `newest-desktop-control`'
        : 'Native OpenAI Codex computer-use requires macOS',
    ],
  },
  {
    name: 'top-level run help',
    args: ['run', '--help'],
    includes: [
      'Agent Runs',
      '/run list [status]',
      '/run recover <id> [summary]',
    ],
  },
  {
    name: 'top-level run list',
    args: ['runs', 'list'],
    env: () => ({
      CLAUDE_CONFIG_DIR: bgControlConfigDir,
      CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS: '1',
    }),
    includes: [
      'Agent Runs',
      'test prompt',
    ],
  },
  {
    name: 'top-level channel help',
    args: ['channel', '--help'],
    env: createIsolatedConfigEnv,
    includes: [
      'Channel Adapters',
      'telegram - not connected',
      'console - built in',
    ],
  },
  {
    name: 'top-level channel console status',
    args: ['channel', 'status', 'console'],
    includes: [
      'Channel Adapter Status',
      'Console',
      'console - built in',
    ],
  },
  {
    name: 'top-level connect help',
    args: ['connect', '--help'],
    env: createIsolatedConfigEnv,
    includes: [
      'Connect Telegram to DuckHive',
      '/connect <your-bot-token>',
      'DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID',
    ],
  },
  {
    name: 'top-level telegram status alias',
    args: ['telegram', 'status'],
    env: createIsolatedConfigEnv,
    includes: [
      'Telegram Connection Status',
      'Status: Not connected',
    ],
  },
  {
    name: 'top-level skill help',
    args: ['skill', '--help'],
    env: createIsolatedConfigEnv,
    includes: [
      'Skill Workshop',
      '/skill search <query>',
      '/skill install <slug>',
    ],
  },
  {
    name: 'top-level skills list',
    args: ['skills'],
    env: createIsolatedConfigEnv,
    includes: [
      'No saved skills yet',
      '/skill <name>',
    ],
  },
  {
    name: 'top-level skill help after stdin-mode option',
    args: ['--stdin-mode', 'data', 'skill', '--help'],
    env: createIsolatedConfigEnv,
    includes: [
      'Skill Workshop',
      '/skill search <query>',
    ],
  },
  {
    name: 'runtime doctor after stdin-mode option',
    args: ['--stdin-mode', 'data', 'runtime-doctor'],
    includes: [
      '[PASS] CLI input mode',
      'Alternate data stdin mode is explicitly active',
    ],
  },
]

const failures: string[] = []

function checkSmokeCase(
  smokeCase: SmokeCase,
  run: () => ReturnType<typeof spawnSync>,
): void {
  const result = run()
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const normalizedOutput = output.replace(/\s+/g, ' ')

  const expectedStatus = smokeCase.expectedStatus ?? 0
  if (result.status !== expectedStatus) {
    failures.push(
      `${smokeCase.name}: exited ${result.status ?? 'unknown'} instead of ${expectedStatus}\n${output}`,
    )
    return
  }

  for (const expected of smokeCase.includes) {
    if (!normalizedOutput.includes(expected.replace(/\s+/g, ' '))) {
      failures.push(
        `${smokeCase.name}: missing "${expected}"\n${output}`,
      )
    }
  }
}

for (const smokeCase of cases) {
  checkSmokeCase(smokeCase, () => spawnSync(process.execPath, [cliPath, ...smokeCase.args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: smokeCase.timeoutMs,
    env: {
      ...process.env,
      DUCKHIVE_DISABLE_STARTUP_SCREEN: '1',
      ...smokeCase.env?.(),
    },
  }))
}

if (process.platform === 'win32') {
  const wrapperCases: SmokeCase[] = [
    {
      name: 'windows wrapper version',
      args: ['--version'],
      includes: ['DuckHive'],
    },
    {
      name: 'windows wrapper yolo version alias',
      args: ['--yolo', '--version'],
      includes: ['DuckHive'],
    },
    {
      name: 'windows wrapper dangerously skip permissions version',
      args: ['--dangerously-skip-permissions', '--version'],
      includes: ['DuckHive'],
    },
    {
      name: 'windows wrapper tui help',
      args: ['tui', '--help'],
      includes: [
        'Usage: duckhive tui',
        'Launch the DuckHive Bubble Tea TUI',
      ],
    },
    {
      name: 'windows wrapper tui missing binary failure',
      args: ['tui'],
      expectedStatus: 1,
      includes: [
        'DuckHive TUI binary was not found',
        'The default classic REPL still works with',
      ],
    },
    {
      name: 'windows wrapper strict interactive failure',
      args: ['runtime-doctor', '--strict-interactive'],
      expectedStatus: 1,
      includes: [
        '[FAIL] Terminal stdio',
        'Strict interactive check failed',
      ],
    },
  ]

  for (const smokeCase of wrapperCases) {
    checkSmokeCase(smokeCase, () => spawnSync(windowsLauncherPath, smokeCase.args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: smokeCase.timeoutMs,
      env: {
        ...process.env,
        DUCKHIVE_DISABLE_STARTUP_SCREEN: '1',
        ...smokeCase.env?.(),
      },
    }))
  }
}

for (const tempDir of tempDirs) {
  rmSync(tempDir, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`CLI smoke failed:\n${failures.join('\n\n')}`)
  process.exit(1)
}

console.log(`CLI smoke passed (${cases.length} commands${process.platform === 'win32' ? ' plus Windows wrapper checks' : ''}).`)
