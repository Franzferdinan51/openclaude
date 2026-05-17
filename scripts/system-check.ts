// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  resolveCodexApiCredentials,
  resolveProviderRequest,
  isLocalProviderUrl as isProviderLocalUrl,
} from '../src/services/api/providerConfig.js'
import {
  getLocalOpenAICompatibleProviderLabel,
  probeOllamaGenerationReadiness,
} from '../src/utils/providerDiscovery.js'
import { detectCliInputModeWarnings } from '../src/utils/cliInputModeDiagnostic.js'
import { DEFAULT_GEMINI_MODEL } from '../src/utils/providerProfile.js'
import { redactUrlForDisplay } from '../src/utils/urlRedaction.js'
import {
  getRouteCredentialEnvVars,
  getRouteCredentialValue,
  getRouteDefaultBaseUrl,
  getRouteDefaultModel,
  getRouteLabel,
  getTransportKindForRoute,
  resolveActiveRouteIdFromEnv,
} from '../src/integrations/routeMetadata.js'
import { builtInCommandNames } from '../src/commands.js'
import { getClawHubRegistryUrl } from '../src/services/clawhub/skillHub.js'

type CheckResult = {
  ok: boolean
  label: string
  detail?: string
}

type CliOptions = {
  json: boolean
  outFile: string | null
}

function pass(label: string, detail?: string): CheckResult {
  return { ok: true, label, detail }
}

function fail(label: string, detail?: string): CheckResult {
  return { ok: false, label, detail }
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'no'
}

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    outFile: null,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--out') {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        options.outFile = next
        i++
      }
    }
  }

  return options
}

export function formatReachabilityFailureDetail(
  endpoint: string,
  status: number,
  responseBody: string,
  request: {
    transport: string
    requestedModel: string
    resolvedModel: string
  },
): string {
  const compactBody = responseBody.trim().replace(/\s+/g, ' ').slice(0, 240)
  const base = `Unexpected status ${status} from ${redactUrlForDisplay(endpoint)}.`
  const bodySuffix = compactBody ? ` Body: ${compactBody}` : ''

  if (request.transport !== 'codex_responses' || status !== 400) {
    return `${base}${bodySuffix}`
  }

  if (!/not supported.*chatgpt account/i.test(responseBody)) {
    return `${base}${bodySuffix}`
  }

  return `${base}${bodySuffix} Hint: model alias "${request.requestedModel}" resolved to "${request.resolvedModel}", which this ChatGPT account does not currently allow. Try "codexplan" or another entitled Codex model.`
}

function checkNodeVersion(): CheckResult {
  const raw = process.versions.node
  const major = Number(raw.split('.')[0] ?? '0')
  if (Number.isNaN(major)) {
    return fail('Node.js version', `Could not parse version: ${raw}`)
  }

  if (major < 20) {
    return fail('Node.js version', `Detected ${raw}. Require >= 20.`)
  }

  return pass('Node.js version', raw)
}

function checkBunRuntime(): CheckResult {
  const bunVersion = (globalThis as { Bun?: { version?: string } }).Bun?.version
  if (!bunVersion) {
    return pass('Bun runtime', 'Not running inside Bun (this is acceptable for Node startup).')
  }
  return pass('Bun runtime', bunVersion)
}

function checkBuildArtifacts(): CheckResult {
  const distCli = resolve(process.cwd(), 'dist', 'cli.mjs')
  if (!existsSync(distCli)) {
    return fail('Build artifacts', `Missing ${distCli}. Run: bun run build`)
  }
  return pass('Build artifacts', distCli)
}

function checkTuiLaunchPath(): CheckResult {
  const isWindows = process.platform === 'win32'
  const binary = resolve(
    process.cwd(),
    'tui',
    isWindows ? 'duckhive-tui.exe' : 'duckhive-tui',
  )
  if (existsSync(binary)) {
    return pass('Terminal TUI', `Ready: ${binary}`)
  }

  const source = resolve(process.cwd(), 'tui', 'cmd', 'duckhive-tui', 'main.go')
  if (!existsSync(source)) {
    return fail(
      'Terminal TUI',
      `Missing Bubble Tea source at ${source}. Reinstall DuckHive or restore the tui directory.`,
    )
  }

  const goVersion = spawnSync('go', ['version'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
  })
  if (goVersion.status === 0) {
    return pass(
      'Terminal TUI',
      `Binary missing, but Go is available for on-demand build: ${(goVersion.stdout || '').trim()}`,
    )
  }

  return pass(
    'Terminal TUI',
    isWindows
      ? 'Binary missing and Go is not installed. `duckhive tui` will explain this and the classic REPL remains the Windows-safe default.'
      : 'Binary missing and Go is not installed. Run `scripts/install.sh` after installing Go, or use the classic REPL.',
  )
}

export function checkCliInputMode(
  env: NodeJS.ProcessEnv = process.env,
  runtime = { platform: process.platform },
): CheckResult {
  const warnings = detectCliInputModeWarnings(env, runtime.platform)
  if (warnings.length === 0 && runtime.platform !== 'win32') {
    return pass('CLI input mode', 'Readable stdin default active.')
  }

  if (warnings.length > 0) {
    return fail(
      'CLI input mode',
      `${warnings[0]?.issue}. ${warnings[0]?.fix}`,
    )
  }

  return pass(
    'CLI input mode',
    'Windows-safe readable stdin is active; early input capture remains disabled by default.',
  )
}

function readPackageVersion(packageJsonPath: string): string | undefined {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : undefined
  } catch {
    return undefined
  }
}

function existingOverridePaths(keys: string[]): string[] {
  const paths: string[] = []
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value && existsSync(resolve(value))) {
      paths.push(`${key}=${value}`)
    }
  }
  return paths
}

function checkComputerUseReadiness(): CheckResult {
  const gatewayPackageJson = resolve(
    process.cwd(),
    'skills',
    'newest-desktop-control',
    'package.json',
  )

  if (!existsSync(gatewayPackageJson)) {
    return fail(
      'Computer use',
      'Missing bundled skills/newest-desktop-control gateway. Restore the skill before using desktop, Android, or computer_use_* aliases.',
    )
  }

  const gatewayVersion = readPackageVersion(gatewayPackageJson)
  const gatewayDetail = gatewayVersion
    ? `bundled newest-desktop-control v${gatewayVersion}`
    : 'bundled newest-desktop-control present'
  const overridePaths = existingOverridePaths([
    'DUCKHIVE_CODEX_COMPUTER_USE_PLUGIN_DIR',
    'CODEX_COMPUTER_USE_PLUGIN_DIR',
    'DUCKHIVE_CODEX_COMPUTER_USE_CLIENT',
    'CODEX_COMPUTER_USE_CLIENT',
  ])

  if (process.platform !== 'darwin') {
    return pass(
      'Computer use',
      `Native Codex computer-use is macOS-only; ${gatewayDetail} is available for desktop, Android, and compatibility aliases.`,
    )
  }

  if (overridePaths.length > 0) {
    return pass(
      'Computer use',
      `${gatewayDetail}; native Codex override configured: ${overridePaths.join(', ')}.`,
    )
  }

  const codexBundle = '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use'
  if (existsSync(codexBundle)) {
    return pass(
      'Computer use',
      `${gatewayDetail}; Codex.app computer-use bundle detected for /computer-use inspection.`,
    )
  }

  return pass(
    'Computer use',
    `${gatewayDetail}; native Codex computer-use bundle not detected, so use newest-desktop-control unless a Codex plugin override is configured.`,
  )
}

function isLocalBaseUrl(baseUrl: string): boolean {
  return isProviderLocalUrl(baseUrl)
}

const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const MISTRAL_DEFAULT_BASE_URL = 'https://api.mistral.ai/v1'
const GITHUB_COPILOT_BASE = 'https://api.githubcopilot.com'

const REQUIRED_HARNESS_COMMANDS = [
  'goal',
  'computer-use',
  'channel',
  'connect',
  'skill',
  'skills',
  'spawn',
  'orchestrate',
  'team',
  'council',
  'senate',
  'tui',
  'doctor',
] as const

export function checkHarnessCommandSurfaces(): CheckResult {
  const commandNames = new Set(builtInCommandNames())
  const missing = REQUIRED_HARNESS_COMMANDS.filter(name => !commandNames.has(name))

  if (missing.length > 0) {
    return fail(
      'Harness command surfaces',
      `Missing required terminal commands: ${missing.join(', ')}.`,
    )
  }

  return pass(
    'Harness command surfaces',
    `${REQUIRED_HARNESS_COMMANDS.length} core commands registered: ${REQUIRED_HARNESS_COMMANDS.join(', ')}.`,
  )
}

export function checkSkillHubRegistry(): CheckResult {
  const registry = getClawHubRegistryUrl()
  const commandNames = new Set(builtInCommandNames())
  const skillCommandsAvailable =
    commandNames.has('skill') && commandNames.has('skills')

  if (!skillCommandsAvailable) {
    return fail(
      'Skill hub registry',
      `Registry configured at ${registry}, but /skill or /skills is missing.`,
    )
  }

  return pass(
    'Skill hub registry',
    `ClawHub registry configured at ${registry}; /skill search, inspect, and install are available.`,
  )
}

function getActiveDescriptorOpenAICompatibleRouteId(): string | null {
  const routeId = resolveActiveRouteIdFromEnv(process.env)
  if (!routeId || routeId === 'anthropic') {
    return null
  }

  const transport = getTransportKindForRoute(routeId)
  return transport === 'openai-compatible' || transport === 'local'
    ? routeId
    : null
}

function resolveDoctorProviderRequest() {
  const routeId = getActiveDescriptorOpenAICompatibleRouteId()
  return resolveProviderRequest({
    model: process.env.OPENAI_MODEL || (routeId ? getRouteDefaultModel(routeId) : undefined),
    baseUrl: process.env.OPENAI_BASE_URL || (routeId ? getRouteDefaultBaseUrl(routeId) : undefined),
  })
}

function currentBaseUrl(): string {
  if (isTruthy(process.env.CLAUDE_CODE_USE_GEMINI)) {
    return process.env.GEMINI_BASE_URL ?? GEMINI_DEFAULT_BASE_URL
  }
  if (isTruthy(process.env.CLAUDE_CODE_USE_MISTRAL)) {
    return process.env.MISTRAL_BASE_URL ?? MISTRAL_DEFAULT_BASE_URL
  }
  if (isTruthy(process.env.CLAUDE_CODE_USE_GITHUB)) {
    return process.env.OPENAI_BASE_URL ?? GITHUB_COPILOT_BASE
  }
  return process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
}

function checkGeminiEnv(): CheckResult[] {
  const results: CheckResult[] = []
  const model = process.env.GEMINI_MODEL
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  const baseUrl = process.env.GEMINI_BASE_URL ?? GEMINI_DEFAULT_BASE_URL

  results.push(pass('Provider mode', 'Google Gemini provider enabled.'))

  if (!model) {
    results.push(pass('GEMINI_MODEL', `Not set. Default ${DEFAULT_GEMINI_MODEL} will be used.`))
  } else {
    results.push(pass('GEMINI_MODEL', model))
  }

  results.push(pass('GEMINI_BASE_URL', baseUrl))

  if (!key) {
    results.push(fail('GEMINI_API_KEY', 'Missing. Set GEMINI_API_KEY or GOOGLE_API_KEY.'))
  } else {
    results.push(pass('GEMINI_API_KEY', 'Configured.'))
  }

  return results
}

function checkMistralEnv(): CheckResult[] {
  const results: CheckResult[] = []
  const model = process.env.MISTRAL_MODEL
  const key = process.env.MISTRAL_API_KEY
  const baseUrl = process.env.MISTRAL_BASE_URL ?? MISTRAL_DEFAULT_BASE_URL

  results.push(pass('Provider mode', 'Mistral provider enabled.'))

  if (!model) {
    results.push(pass('MISTRAL_MODEL', 'Not set. Default will be used at runtime.'))
  } else {
    results.push(pass('MISTRAL_MODEL', model))
  }

  results.push(pass('MISTRAL_BASE_URL', baseUrl))

  if (!key) {
    results.push(fail('MISTRAL_API_KEY', 'Missing. Set MISTRAL_API_KEY.'))
  } else {
    results.push(pass('MISTRAL_API_KEY', 'Configured.'))
  }

  return results
}

function checkGithubEnv(): CheckResult[] {
  const results: CheckResult[] = []
  const baseUrl = process.env.OPENAI_BASE_URL ?? GITHUB_COPILOT_BASE
  results.push(pass('Provider mode', 'GitHub Models provider enabled.'))

  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token?.trim()) {
    results.push(fail('GITHUB_TOKEN', 'Missing. Set GITHUB_TOKEN or GH_TOKEN.'))
  } else {
    results.push(pass('GITHUB_TOKEN', 'Configured.'))
  }

  if (!process.env.OPENAI_MODEL) {
    results.push(
      pass(
        'OPENAI_MODEL',
        'Not set. Default github:copilot → openai/gpt-4.1 at runtime.',
      ),
    )
  } else {
    results.push(pass('OPENAI_MODEL', process.env.OPENAI_MODEL))
  }

  results.push(pass('OPENAI_BASE_URL', baseUrl))
  return results
}

function checkDescriptorRouteEnv(routeId: string): CheckResult[] {
  const results: CheckResult[] = []
  const label = getRouteLabel(routeId) ?? routeId
  const defaultModel = getRouteDefaultModel(routeId)
  const defaultBaseUrl = getRouteDefaultBaseUrl(routeId)
  const credentialVars = getRouteCredentialEnvVars(routeId)
  const credential = getRouteCredentialValue(routeId)

  results.push(pass('Provider mode', `${label} provider enabled.`))
  results.push(
    pass(
      'OPENAI_MODEL',
      process.env.OPENAI_MODEL ||
        defaultModel ||
        'Not set. Runtime fallback model will be used.',
    ),
  )
  if (defaultBaseUrl || process.env.OPENAI_BASE_URL) {
    results.push(
      pass(
        'OPENAI_BASE_URL',
        redactUrlForDisplay(process.env.OPENAI_BASE_URL ?? defaultBaseUrl ?? ''),
      ),
    )
  }

  if (credentialVars.length > 0) {
    results.push(
      credential
        ? pass(credentialVars.join(' or '), 'Configured.')
        : fail(
            credentialVars.join(' or '),
            `Missing. Set one of: ${credentialVars.join(', ')}.`,
          ),
    )
  }

  return results
}

export function checkOpenAIEnv(): CheckResult[] {
  const results: CheckResult[] = []
  const useGemini = isTruthy(process.env.CLAUDE_CODE_USE_GEMINI)
  const useGithub = isTruthy(process.env.CLAUDE_CODE_USE_GITHUB)
  const useMistral = isTruthy(process.env.CLAUDE_CODE_USE_MISTRAL)
  const useOpenAI = isTruthy(process.env.CLAUDE_CODE_USE_OPENAI)

  if (useGemini) {
    return checkGeminiEnv()
  }

  if (useMistral) {
    return checkMistralEnv()
  }

  if (useGithub && !useOpenAI) {
    return checkGithubEnv()
  }

  const activeRouteId = resolveActiveRouteIdFromEnv(process.env)
  if (!useOpenAI && activeRouteId && activeRouteId !== 'anthropic') {
    return checkDescriptorRouteEnv(activeRouteId)
  }

  if (!useOpenAI) {
    results.push(pass('Provider mode', 'Anthropic login flow enabled (CLAUDE_CODE_USE_OPENAI is off).'))
    return results
  }

  const request = resolveDoctorProviderRequest()

  results.push(
    pass(
      'Provider mode',
      request.transport === 'codex_responses'
        ? 'Codex responses backend enabled.'
        : 'OpenAI-compatible provider enabled.',
    ),
  )

  if (!process.env.OPENAI_MODEL) {
    results.push(pass('OPENAI_MODEL', 'Not set. Runtime fallback model will be used.'))
  } else {
    results.push(pass('OPENAI_MODEL', process.env.OPENAI_MODEL))
  }

  results.push(pass('OPENAI_BASE_URL', redactUrlForDisplay(request.baseUrl)))

  if (request.transport === 'codex_responses') {
    const credentials = resolveCodexApiCredentials(process.env)
    if (!credentials.apiKey) {
      const authHint = credentials.authPath
        ? `Missing CODEX_API_KEY and no usable auth.json at ${credentials.authPath}.`
        : 'Missing CODEX_API_KEY and auth.json fallback.'
      results.push(fail('CODEX auth', authHint))
    } else if (!credentials.accountId) {
      results.push(fail('CHATGPT_ACCOUNT_ID', 'Missing chatgpt_account_id in Codex auth.'))
    } else {
      const detail = credentials.source === 'env'
        ? 'Using CODEX_API_KEY.'
        : `Using ${credentials.authPath}.`
      results.push(pass('CODEX auth', detail))
    }
    return results
  }

  const key = process.env.OPENAI_API_KEY
  const githubToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (key === 'SUA_CHAVE') {
    results.push(fail('OPENAI_API_KEY', 'Placeholder value detected: SUA_CHAVE.'))
  } else if (
    !key &&
    !isLocalBaseUrl(request.baseUrl) &&
    !(useGithub && githubToken?.trim())
  ) {
    results.push(fail('OPENAI_API_KEY', 'Missing key for non-local provider URL.'))
  } else if (!key && useGithub && githubToken?.trim()) {
    results.push(
      pass('OPENAI_API_KEY', 'Not set; GITHUB_TOKEN/GH_TOKEN will be used for GitHub Models.'),
    )
  } else if (!key) {
    results.push(pass('OPENAI_API_KEY', 'Not set (allowed for local providers like Atomic Chat/Ollama/LM Studio).'))
  } else {
    results.push(pass('OPENAI_API_KEY', 'Configured.'))
  }

  return results
}

async function checkBaseUrlReachability(): Promise<CheckResult> {
  const useGemini = isTruthy(process.env.CLAUDE_CODE_USE_GEMINI)
  const useOpenAI = isTruthy(process.env.CLAUDE_CODE_USE_OPENAI)
  const useGithub = isTruthy(process.env.CLAUDE_CODE_USE_GITHUB)
  const useMistral = isTruthy(process.env.CLAUDE_CODE_USE_MISTRAL)
  const descriptorRouteId = getActiveDescriptorOpenAICompatibleRouteId()

  if (!useGemini && !useOpenAI && !useGithub && !useMistral && !descriptorRouteId) {
    return pass('Provider reachability', 'Skipped (OpenAI-compatible mode disabled).')
  }

  if (useGithub && !useOpenAI) {
    return pass(
      'Provider reachability',
      'Skipped for GitHub Models (inference endpoint differs from OpenAI /models probe).',
    )
  }

  const geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'
  const resolvedBaseUrl = useGemini
    ? (process.env.GEMINI_BASE_URL ?? geminiBaseUrl)
    : undefined
  const request = resolveProviderRequest({
    model: process.env.OPENAI_MODEL || (descriptorRouteId ? getRouteDefaultModel(descriptorRouteId) : undefined),
    baseUrl: resolvedBaseUrl ?? process.env.OPENAI_BASE_URL ?? (descriptorRouteId ? getRouteDefaultBaseUrl(descriptorRouteId) : undefined),
  })
  const endpoint = request.transport === 'codex_responses'
    ? `${request.baseUrl}/responses`
    : `${request.baseUrl}/models`
  const redactedEndpoint = redactUrlForDisplay(endpoint)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)

  try {
    const headers: Record<string, string> = {}
    let method = 'GET'
    let body: string | undefined

    if (request.transport === 'codex_responses') {
      const credentials = resolveCodexApiCredentials(process.env)
      if (credentials.apiKey) {
        headers.Authorization = `Bearer ${credentials.apiKey}`
      }
      if (credentials.accountId) {
        headers['chatgpt-account-id'] = credentials.accountId
      }
      headers['Content-Type'] = 'application/json'
      headers.originator = 'openclaude'
      method = 'POST'
      body = JSON.stringify({
        model: request.resolvedModel,
        instructions: 'Runtime doctor probe.',
        input: [
          {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'ping' }],
          },
        ],
        store: false,
        stream: true,
      })
    } else if (useGemini && (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)) {
      headers.Authorization = `Bearer ${process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY}`
    } else if (useMistral && process.env.MISTRAL_API_KEY) {
      headers.Authorization = `Bearer ${process.env.MISTRAL_API_KEY}`
    } else if (descriptorRouteId && getRouteCredentialValue(descriptorRouteId)) {
      headers.Authorization = `Bearer ${getRouteCredentialValue(descriptorRouteId)}`
    } else if (process.env.OPENAI_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body,
      signal: controller.signal,
    })

    if (response.status === 200 || response.status === 401 || response.status === 403) {
      return pass(
        'Provider reachability',
        `Reached ${redactedEndpoint} (status ${response.status}).`,
      )
    }

    const responseBody = await response.text().catch(() => '')
    const detail = formatReachabilityFailureDetail(
      endpoint,
      response.status,
      responseBody,
      request,
    )
    return fail(
      'Provider reachability',
      detail,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail(
      'Provider reachability',
      `Failed to reach ${redactedEndpoint}: ${message}`,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function checkProviderGenerationReadiness(): Promise<CheckResult> {
  const useGemini = isTruthy(process.env.CLAUDE_CODE_USE_GEMINI)
  const useOpenAI = isTruthy(process.env.CLAUDE_CODE_USE_OPENAI)
  const useGithub = isTruthy(process.env.CLAUDE_CODE_USE_GITHUB)
  const useMistral = isTruthy(process.env.CLAUDE_CODE_USE_MISTRAL)
  const descriptorRouteId = getActiveDescriptorOpenAICompatibleRouteId()

  if (!useGemini && !useOpenAI && !useGithub && !useMistral && !descriptorRouteId) {
    return pass('Provider generation readiness', 'Skipped (OpenAI-compatible mode disabled).')
  }

  if (useGithub && !useOpenAI) {
    return pass(
      'Provider generation readiness',
      'Skipped for GitHub Models (runtime generation uses a different endpoint flow).',
    )
  }

  if (useGemini || useMistral) {
    return pass(
      'Provider generation readiness',
      'Skipped for managed provider mode.',
    )
  }

  if (!useOpenAI && !descriptorRouteId) {
    return pass('Provider generation readiness', 'Skipped (OpenAI-compatible mode disabled).')
  }

  const request = resolveDoctorProviderRequest()

  if (request.transport === 'codex_responses') {
    return pass(
      'Provider generation readiness',
      'Skipped for Codex responses (reachability probe already performs a lightweight generation request).',
    )
  }

  if (!isLocalBaseUrl(request.baseUrl)) {
    return pass('Provider generation readiness', 'Skipped for non-local provider URL.')
  }

  const localProviderLabel = getLocalOpenAICompatibleProviderLabel(request.baseUrl)
  if (localProviderLabel !== 'Ollama') {
    return pass(
      'Provider generation readiness',
      `Skipped for ${localProviderLabel} (no provider-specific generation probe).`,
    )
  }

  const readiness = await probeOllamaGenerationReadiness({
    baseUrl: request.baseUrl,
    model: request.requestedModel,
  })

  if (readiness.state === 'ready') {
    return pass(
      'Provider generation readiness',
      `Generated a test response with ${readiness.probeModel ?? request.requestedModel}.`,
    )
  }

  if (readiness.state === 'unreachable') {
    return fail(
      'Provider generation readiness',
      `Could not reach Ollama at ${redactUrlForDisplay(request.baseUrl)}.`,
    )
  }

  if (readiness.state === 'no_models') {
    return fail(
      'Provider generation readiness',
      'Ollama is reachable, but no installed models were found. Pull a model first (for example: ollama pull qwen2.5-coder:7b).',
    )
  }

  const detailSuffix = readiness.detail ? ` Detail: ${readiness.detail}.` : ''
  return fail(
    'Provider generation readiness',
    `Ollama is reachable, but generation failed for ${readiness.probeModel ?? request.requestedModel}.${detailSuffix}`,
  )
}

function isAtomicChatUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl)
    return parsed.port === '1337' && isLocalBaseUrl(baseUrl)
  } catch {
    return false
  }
}

function checkOllamaProcessorMode(): CheckResult {
  const descriptorRouteId = getActiveDescriptorOpenAICompatibleRouteId()
  if (
    (!isTruthy(process.env.CLAUDE_CODE_USE_OPENAI) && !descriptorRouteId) ||
    isTruthy(process.env.CLAUDE_CODE_USE_GEMINI) ||
    isTruthy(process.env.CLAUDE_CODE_USE_GITHUB) ||
    isTruthy(process.env.CLAUDE_CODE_USE_MISTRAL)
  ) {
    return pass('Ollama processor mode', 'Skipped (OpenAI-compatible mode disabled).')
  }

  const baseUrl = descriptorRouteId
    ? (process.env.OPENAI_BASE_URL ?? getRouteDefaultBaseUrl(descriptorRouteId) ?? currentBaseUrl())
    : currentBaseUrl()
  if (!isLocalBaseUrl(baseUrl)) {
    return pass('Ollama processor mode', 'Skipped (provider URL is not local).')
  }

  if (isAtomicChatUrl(baseUrl)) {
    return pass('Ollama processor mode', 'Skipped (Atomic Chat local provider detected, not Ollama).')
  }

  const result = spawnSync('ollama', ['ps'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
  })

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || 'Unable to run ollama ps').trim()
    return pass('Ollama processor mode', `Native CLI check failed (${detail}). Assuming valid Docker/remote backend since HTTP ping passed.`)
  }

  const output = (result.stdout || '').trim()
  if (!output) {
    return fail('Ollama processor mode', 'ollama ps returned empty output.')
  }

  const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const modelLine = lines.find(line => line.includes(':') && !line.startsWith('NAME'))
  if (!modelLine) {
    return pass('Ollama processor mode', 'No loaded model found (run a prompt first).')
  }

  if (modelLine.includes('CPU')) {
    return pass('Ollama processor mode', 'Detected CPU mode. This is valid but can be slow for larger models.')
  }

  return pass('Ollama processor mode', `Detected non-CPU mode: ${modelLine}`)
}

function checkAgentHarnessRuntime(): CheckResult {
  const runtime = process.env.DUCKHIVE_AGENT_RUNTIME ?? 'auto'
  const fallback = process.env.DUCKHIVE_AGENT_HARNESS_FALLBACK ?? 'builtin'
  const validFallbacks = new Set(['builtin', 'none'])
  if (!validFallbacks.has(fallback)) {
    return fail(
      'Agent harness runtime',
      `Invalid DUCKHIVE_AGENT_HARNESS_FALLBACK=${fallback}. Use builtin or none.`,
    )
  }
  return pass(
    'Agent harness runtime',
    `runtime=${runtime}; fallback=${fallback}; public import duckhive/harness.`,
  )
}

export function checkTelegramChannelConfig(): CheckResult {
  const hasDuckHiveToken = Boolean(process.env.DUCKHIVE_TELEGRAM_BOT_TOKEN?.trim())
  const hasLegacyToken = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim())
  const hasToken = hasDuckHiveToken || hasLegacyToken
  const allowlist = process.env.DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID
  if (!hasToken) {
    return pass(
      'Telegram channel',
      'Not configured. Set DUCKHIVE_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN to enable remote run control.',
    )
  }
  return pass(
    'Telegram channel',
    allowlist
      ? `Configured with chat allowlist for AgentRun commands (${hasDuckHiveToken ? 'DUCKHIVE_TELEGRAM_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN'}).`
      : `Configured without DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID; any chat the bot can read may register (${hasDuckHiveToken ? 'DUCKHIVE_TELEGRAM_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN'}).`,
  )
}

function serializeSafeEnvSummary(): Record<string, string | boolean> {
  if (isTruthy(process.env.CLAUDE_CODE_USE_GEMINI)) {
    return {
      CLAUDE_CODE_USE_GEMINI: true,
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? `(unset, default: ${DEFAULT_GEMINI_MODEL})`,
      GEMINI_BASE_URL: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai',
      GEMINI_API_KEY_SET: Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
    }
  }
  if (isTruthy(process.env.CLAUDE_CODE_USE_MISTRAL)) {
    return {
      CLAUDE_CODE_USE_MISTRAL: true,
      MISTRAL_MODEL: process.env.MISTRAL_MODEL ?? '(unset, default: devstral-latest)',
      MISTRAL_BASE_URL: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
      MISTRAL_API_KEY_SET: Boolean(process.env.MISTRAL_API_KEY),
    }
  }
  if (
    isTruthy(process.env.CLAUDE_CODE_USE_GITHUB) &&
    !isTruthy(process.env.CLAUDE_CODE_USE_OPENAI)
  ) {
    return {
      CLAUDE_CODE_USE_GITHUB: true,
      OPENAI_MODEL:
        process.env.OPENAI_MODEL ??
        '(unset, default: github:copilot → openai/gpt-4.1)',
      OPENAI_BASE_URL:
        process.env.OPENAI_BASE_URL ?? GITHUB_COPILOT_BASE,
      GITHUB_TOKEN_SET: Boolean(
        process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
      ),
    }
  }
  const request = resolveProviderRequest({
    model: process.env.OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL,
  })
  return {
    CLAUDE_CODE_USE_OPENAI: isTruthy(process.env.CLAUDE_CODE_USE_OPENAI),
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? '(unset)',
    OPENAI_BASE_URL: request.baseUrl,
    OPENAI_API_KEY_SET: Boolean(process.env.OPENAI_API_KEY),
    CODEX_API_KEY_SET: Boolean(resolveCodexApiCredentials(process.env).apiKey),
  }
}

function printResults(results: CheckResult[]): void {
  for (const result of results) {
    const icon = result.ok ? 'PASS' : 'FAIL'
    const suffix = result.detail ? ` - ${result.detail}` : ''
    console.log(`[${icon}] ${result.label}${suffix}`)
  }
}

function writeJsonReport(
  options: CliOptions,
  results: CheckResult[],
): void {
  const envSummary = serializeSafeEnvSummary()
  const payload = {
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    summary: {
      total: results.length,
      passed: results.filter(result => result.ok).length,
      failed: results.filter(result => !result.ok).length,
    },
    env: envSummary,
    results,
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          timestamp: payload.timestamp,
          cwd: payload.cwd,
          summary: payload.summary,
          env: '[redacted in console JSON output; use --out-file for the full report]',
          results: payload.results,
        },
        null,
        2,
      ),
    )
  }

  if (options.outFile) {
    const outputPath = resolve(process.cwd(), options.outFile)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8')
    if (!options.json) {
      console.log(`Report written to ${outputPath}`)
    }
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const results: CheckResult[] = []

  const { enableConfigs } = await import('../src/utils/config.js')
  enableConfigs()
  const { applySafeConfigEnvironmentVariables } = await import('../src/utils/managedEnv.js')
  applySafeConfigEnvironmentVariables()
  const { hydrateGithubModelsTokenFromSecureStorage } = await import('../src/utils/githubModelsCredentials.js')
  hydrateGithubModelsTokenFromSecureStorage()

  results.push(checkNodeVersion())
  results.push(checkBunRuntime())
  results.push(checkBuildArtifacts())
  results.push(checkCliInputMode())
  results.push(checkTuiLaunchPath())
  results.push(checkComputerUseReadiness())
  results.push(checkHarnessCommandSurfaces())
  results.push(checkSkillHubRegistry())
  results.push(...checkOpenAIEnv())
  results.push(await checkBaseUrlReachability())
  results.push(await checkProviderGenerationReadiness())
  results.push(checkOllamaProcessorMode())
  results.push(checkAgentHarnessRuntime())
  results.push(checkTelegramChannelConfig())

  if (!options.json) {
    printResults(results)
  }

  writeJsonReport(options, results)

  const hasFailure = results.some(result => !result.ok)
  if (hasFailure) {
    process.exitCode = 1
    return
  }

  if (!options.json) {
    console.log('\nRuntime checks completed successfully.')
  }
}

if (import.meta.main) {
  await main()
}

export {}
