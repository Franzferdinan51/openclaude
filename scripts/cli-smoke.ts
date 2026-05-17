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
    includes: [
      'Usage: duckhive',
      'input-test',
      'runtime-doctor',
      'goal',
      'computer-use',
      'mmx',
      'provider',
      'channel',
      'connect',
      'config',
      'skill|skills',
      'spawn',
      '--yolo',
      '--stdin-mode',
    ],
  },
  {
    name: 'doctor help',
    args: ['doctor', '--help'],
    includes: [
      'Usage: duckhive doctor',
      'terminal input is not usable',
      'duckhive input-test',
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
    name: 'runtime doctor with yolo alias',
    args: ['--yolo', 'runtime-doctor'],
    includes: [
      '[PASS] CLI input mode',
      '[PASS] Terminal input test',
    ],
  },
  {
    name: 'runtime doctor with dangerously skip permissions',
    args: ['--dangerously-skip-permissions', 'runtime-doctor'],
    includes: [
      '[PASS] CLI input mode',
      '[PASS] Terminal input test',
    ],
  },
  {
    name: 'runtime doctor with allow dangerous option',
    args: ['--allow-dangerously-skip-permissions', 'runtime-doctor'],
    includes: [
      '[PASS] CLI input mode',
      '[PASS] Terminal input test',
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
    name: 'config help',
    args: ['config', '--help'],
    includes: [
      'DuckHive config',
      'duckhive config show',
      'duckhive config init',
      'duckhive config path',
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
    name: 'tui help',
    args: ['tui', '--help'],
    includes: [
      'Usage: duckhive tui',
      'Launch the DuckHive Bubble Tea TUI',
      'Windows-safe input path',
      'duckhive runtime-doctor',
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
      'duckhive input-test',
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
      'duckhive computer-use status',
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
        ? 'duckhive computer-use'
        : 'duckhive desktop',
      process.platform === 'darwin'
        ? 'Fallback gateway: `newest-desktop-control`'
        : 'Native OpenAI Codex computer-use requires macOS',
    ],
  },
  {
    name: 'top-level mmx help',
    args: ['mmx', '--help'],
    includes: [
      'DuckHive MiniMax Integration',
      'duckhive mmx text chat',
      'duckhive mmx image',
      'duckhive mmx quota',
    ],
  },
  {
    name: 'top-level minimax alias help',
    args: ['minimax', '--help'],
    includes: [
      'DuckHive MiniMax Integration',
      'duckhive mmx speech synthesize',
      'duckhive mmx video generate',
    ],
  },
  {
    name: 'top-level provider help',
    args: ['provider', '--help'],
    includes: [
      'DuckHive provider profiles',
      'duckhive provider status',
      '/provider',
    ],
  },
  {
    name: 'top-level provider status',
    args: ['provider', 'status'],
    env: createIsolatedConfigEnv,
    includes: [
      'DuckHive Provider Status',
      'Provider:',
      'Model:',
      'Saved profile:',
    ],
  },
  {
    name: 'top-level run help',
    args: ['run', '--help'],
    includes: [
      'Agent Runs',
      'duckhive run list [status]',
      'duckhive run recover <id> [summary]',
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
    name: 'top-level team help',
    args: ['team', '--help'],
    includes: [
      'Team command',
      '/team list',
      '/team templates',
    ],
  },
  {
    name: 'top-level team templates',
    args: ['team', 'templates'],
    includes: [
      'Team templates',
      'research',
      'code',
      'security',
    ],
  },
  {
    name: 'top-level council help',
    args: ['council', '--help'],
    includes: [
      'AI Council',
      '/council --modes',
      'Available modes:',
    ],
  },
  {
    name: 'top-level senate help',
    args: ['senate', '--help'],
    includes: [
      'Senate command',
      '/senate list',
      '/senate issue',
      '/senate show',
    ],
  },
  {
    name: 'top-level decree help',
    args: ['decree', '--help'],
    includes: [
      'Decree command',
      '/decree list',
      '/decree <title> | <content>',
    ],
  },
  {
    name: 'top-level swarm help',
    args: ['swarm', '--help'],
    includes: [
      'Swarm Command',
      '/swarm <task description>',
      '--dry-run',
    ],
  },
  {
    name: 'top-level spawn help',
    args: ['spawn', '--help'],
    includes: [
      'DuckHive spawn',
      'duckhive spawn <task description>',
      'duckhive subagent <task description>',
    ],
  },
  {
    name: 'top-level subagent queues AgentRun',
    args: ['subagent', 'spawn', 'coding', 'Audit', 'router', '--model', 'qwen3.6-35b'],
    env: createIsolatedConfigEnv,
    includes: [
      'Subagent AgentRun queued:',
      'Task: Audit router',
      'Agent: coding',
      'Model: qwen3.6-35b',
    ],
  },
  {
    name: 'top-level channel help',
    args: ['channel', '--help'],
    env: createIsolatedConfigEnv,
    includes: [
      'Channel Adapters',
      'telegram - not connected',
      'duckhive channel connect telegram --token <TOKEN>',
      '/channel connect telegram --token <TOKEN>',
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
      'duckhive connect <your-bot-token>',
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
    name: 'top-level skills help',
    args: ['skills', '--help'],
    env: createIsolatedConfigEnv,
    includes: [
      'Skill Workshop',
      '/skill search <query>',
      '/skill install <slug>',
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
        'Windows-safe input path',
        'duckhive runtime-doctor',
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
