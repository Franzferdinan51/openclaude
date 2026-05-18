import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

type SmokeCase = {
  name: string
  args: string[]
  includes: string[]
  excludes?: string[]
  expectedStatus?: number
  env?: () => Record<string, string>
  timeoutMs?: number
}

const cliPath = resolve(process.cwd(), 'dist', 'cli.mjs')
const windowsLauncherPath = resolve(process.cwd(), 'bin', 'duckhive.cmd')
const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version as string
const expectedVersionOutput = `${packageVersion} (DuckHive)`
const tempDirs: string[] = []
const bgControlConfigDir = mkdtempSync(join(tmpdir(), 'duckhive-cli-smoke-bg-'))
const exportConfigDir = mkdtempSync(join(tmpdir(), 'duckhive-cli-smoke-export-config-'))
const exportOutputDir = mkdtempSync(join(tmpdir(), 'duckhive-cli-smoke-export-output-'))
tempDirs.push(bgControlConfigDir)
tempDirs.push(exportConfigDir, exportOutputDir)

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
    includes: [expectedVersionOutput],
  },
  {
    name: 'yolo version alias',
    args: ['--yolo', '--version'],
    includes: [expectedVersionOutput],
  },
  {
    name: 'dangerously skip permissions version',
    args: ['--dangerously-skip-permissions', '--version'],
    includes: [expectedVersionOutput],
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
      process.platform === 'win32'
        ? 'data on Windows'
        : 'readable elsewhere',
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
        ? 'Windows data-event stdin is active'
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
        ? 'Windows data-event stdin is active'
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
      '--stdin-mode readable input-test',
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
      '--snapshot',
      '--input-smoke',
      'Windows-safe input path',
      'duckhive runtime-doctor',
    ],
  },
  {
    name: 'tui snapshot',
    args: ['tui', '--snapshot'],
    timeoutMs: 30000,
    includes: [
      'DuckHive Super Agent',
      'A quiet operator shell',
      'ready | /help deck | /goal status',
    ],
    excludes: ['warning: no DUCKHIVE_BRIDGE_SOCKET'],
  },
  {
    name: 'tui input smoke',
    args: ['tui', '--input-smoke', 'typed from cli smoke'],
    timeoutMs: 30000,
    includes: [
      'DuckHive TUI input smoke passed',
      'typed from cli smoke',
    ],
    excludes: ['warning: no DUCKHIVE_BRIDGE_SOCKET'],
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
      'duckhive goal <description>',
      'duckhive goal step add [id] <desc>',
      '/goal <description>',
      '/goal step add',
    ],
  },
  {
    name: 'top-level goal help after stdin-mode option',
    args: ['--stdin-mode', 'data', 'goal', '--help'],
    includes: [
      'DuckHive /goal - Persisted Workflow Goals',
      'duckhive goal <description>',
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
    name: 'top-level computer-use tools',
    args: ['computer-use', 'tools'],
    includes: [
      'DuckHive Computer Use Tools',
      'Native Codex computer-use MCP tools',
      'Bundled newest-desktop-control fallback tools',
      'computer_use_keyboard',
    ],
  },
  {
    name: 'headless loop help',
    args: ['--bare', '-p', '/loop help'],
    timeoutMs: 30000,
    includes: [
      'DuckHive /loop - Scheduled Prompt Loops',
      '/loop status [id]',
      '/loop create "Check git status"',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless android usage',
    args: ['--bare', '-p', '/android'],
    timeoutMs: 30000,
    includes: [
      'Android control',
      '/android devices',
      '/android text "hello world"',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless vision usage',
    args: ['--bare', '-p', '/vision'],
    timeoutMs: 30000,
    includes: [
      'Vision',
      '/vision phone_screenshot',
      '/vision analyze "Describe the screenshot"',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless shadow list',
    args: ['--bare', '-p', '/shadow list'],
    env: createIsolatedConfigEnv,
    timeoutMs: 30000,
    includes: [
      'Shadow Git',
      'No checkpoints yet',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless checkpoint list',
    args: ['--bare', '-p', '/checkpoint list'],
    env: createIsolatedConfigEnv,
    timeoutMs: 30000,
    includes: [
      'No saved checkpoints.',
      '/checkpoint save [name]',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless router list',
    args: ['--bare', '-p', '/router list'],
    timeoutMs: 30000,
    includes: [
      'Available models',
      'MiniMax-M2.7',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless budget status',
    args: ['--bare', '-p', '/budget'],
    env: createIsolatedConfigEnv,
    timeoutMs: 30000,
    includes: [
      'Budget tracker',
      'Global remaining:',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless provider cache stats',
    args: ['--bare', '-p', '/cache stats'],
    env: createIsolatedConfigEnv,
    timeoutMs: 30000,
    includes: [
      'Provider cache',
      'Entries:',
    ],
    excludes: ['Warning: ignoring saved provider profile'],
  },
  {
    name: 'headless export help',
    args: ['--bare', '-p', '/export --help'],
    timeoutMs: 30000,
    includes: [
      'DuckHive /export - Conversation Export',
      '/export --format <text|markdown|json> <filename>',
    ],
    excludes: ['Warning: ignoring saved provider profile', 'Unknown skill: export'],
  },
  {
    name: 'headless export json file',
    args: [
      '--bare',
      '-p',
      `/export --format json "${join(exportOutputDir, 'smoke-session.json')}"`,
    ],
    env: () => ({
      CLAUDE_CONFIG_DIR: exportConfigDir,
      CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS: '1',
    }),
    timeoutMs: 30000,
    includes: [
      'Conversation exported to:',
      'smoke-session.json',
    ],
    excludes: ['Warning: ignoring saved provider profile', 'Unknown skill: export'],
  },
  {
    name: 'headless swarm help',
    args: ['--bare', '-p', '/swarm --help'],
    timeoutMs: 30000,
    includes: [
      'Swarm Command - Parallel Agent Execution',
      'REPL usage:     /swarm <task description>',
      'Voting modes:',
    ],
    excludes: ['Warning: ignoring saved provider profile', 'Unknown skill: swarm'],
  },
  {
    name: 'headless senate help',
    args: ['--bare', '-p', '/senate --help'],
    timeoutMs: 30000,
    includes: [
      'Senate command',
      'duckhive senate list',
      '/senate issue <title>|<content>',
    ],
    excludes: ['Warning: ignoring saved provider profile', 'Hive Nation offline'],
  },
  {
    name: 'headless decree help',
    args: ['--bare', '-p', '/decree --help'],
    timeoutMs: 30000,
    includes: [
      'Decree command',
      'duckhive decree list',
      '/decree <title> | <content>',
    ],
    excludes: ['Warning: ignoring saved provider profile', 'Hive Nation offline'],
  },
  {
    name: 'headless spawn help',
    args: ['--bare', '-p', '/spawn --help'],
    timeoutMs: 30000,
    includes: [
      'DuckHive spawn - Hermes-style subagent spawning',
      '/spawn <task description>',
      'duckhive subagent spawn coding',
    ],
    excludes: ['Warning: ignoring saved provider profile', 'Unknown skill: spawn'],
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
    name: 'top-level runs status shorthand',
    args: ['runs', 'queued'],
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
      'duckhive team list',
      'duckhive team templates',
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
      'duckhive council --modes',
      '/council --modes',
      'Available modes:',
    ],
  },
  {
    name: 'top-level senate help',
    args: ['senate', '--help'],
    includes: [
      'Senate command',
      'duckhive senate list',
      'duckhive senate issue <title>|<content>',
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
      'duckhive decree list',
      'duckhive decree <title> | <content>',
      '/decree list',
      '/decree <title> | <content>',
    ],
  },
  {
    name: 'top-level swarm help',
    args: ['swarm', '--help'],
    includes: [
      'Swarm Command',
      'duckhive swarm <task description>',
      '/swarm <task description>',
      '--dry-run',
    ],
  },
  {
    name: 'top-level orchestrate help',
    args: ['orchestrate', '--help'],
    includes: [
      'Orchestrate Command',
      'duckhive orchestrate <complex task>',
      '/orchestrate <complex task>',
      '--council',
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
      'duckhive telegram <your-bot-token>',
      'duckhive telegram status',
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
      'duckhive skill search <query>',
      'duckhive skill install <slug>',
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
      'duckhive skill search <query>',
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
      'duckhive skill search <query>',
      '/skill search <query>',
    ],
  },
  {
    name: 'runtime doctor after readable stdin-mode option',
    args: ['--stdin-mode', 'readable', 'runtime-doctor'],
    includes: [
      '[PASS] CLI input mode',
      'DuckHive readable compatibility stdin is explicitly active',
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

  for (const forbidden of smokeCase.excludes ?? []) {
    if (normalizedOutput.includes(forbidden.replace(/\s+/g, ' '))) {
      failures.push(
        `${smokeCase.name}: unexpectedly included "${forbidden}"\n${output}`,
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
      includes: [expectedVersionOutput],
    },
    {
      name: 'windows wrapper yolo version alias',
      args: ['--yolo', '--version'],
      includes: [expectedVersionOutput],
    },
    {
      name: 'windows wrapper dangerously skip permissions version',
      args: ['--dangerously-skip-permissions', '--version'],
      includes: [expectedVersionOutput],
    },
    {
      name: 'windows wrapper tui help',
      args: ['tui', '--help'],
      includes: [
        'Usage: duckhive tui',
        'Launch the DuckHive Bubble Tea TUI',
        '--snapshot',
        '--input-smoke',
        'Windows-safe input path',
        'duckhive runtime-doctor',
      ],
    },
    {
      name: 'windows wrapper tui snapshot',
      args: ['tui', '--snapshot'],
      timeoutMs: 30000,
      includes: [
        'DuckHive Super Agent',
        'A quiet operator shell',
        'ready | /help deck | /goal status',
      ],
      excludes: ['warning: no DUCKHIVE_BRIDGE_SOCKET'],
    },
    {
      name: 'windows wrapper tui input smoke',
      args: ['tui', '--input-smoke', 'typed from wrapper smoke'],
      timeoutMs: 30000,
      includes: [
        'DuckHive TUI input smoke passed',
        'typed from wrapper smoke',
      ],
      excludes: ['warning: no DUCKHIVE_BRIDGE_SOCKET'],
    },
    {
      name: 'windows wrapper runtime doctor sees packaged tui',
      args: ['runtime-doctor'],
      includes: [
        '[PASS] Terminal TUI',
        'duckhive-tui.exe',
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
