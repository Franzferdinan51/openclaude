import type { LocalCommandCall } from '../../types/command.js'
import {
  getBudgetState,
  getGlobalRemainingBudget,
  getProvidersByCost,
  resetAllSpend,
  setGlobalBudget,
  setProviderBudget,
  type ProviderId,
} from '../../services/budgetTracker.js'

type BudgetDeps = {
  getBudgetState: typeof getBudgetState
  getGlobalRemainingBudget: typeof getGlobalRemainingBudget
  getProvidersByCost: typeof getProvidersByCost
  resetAllSpend: typeof resetAllSpend
  setGlobalBudget: typeof setGlobalBudget
  setProviderBudget: typeof setProviderBudget
}

let budgetTestDeps: Partial<BudgetDeps> | null = null

function getBudgetDeps(): BudgetDeps {
  return {
    getBudgetState,
    getGlobalRemainingBudget,
    getProvidersByCost,
    resetAllSpend,
    setGlobalBudget,
    setProviderBudget,
    ...budgetTestDeps,
  }
}

export function setBudgetTestDeps(overrides: Partial<BudgetDeps> | null): void {
  budgetTestDeps = overrides
}

function splitCommandArgs(args: string): { args: string[]; error?: string } {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!

    if (quote) {
      if (ch === quote) {
        quote = null
        continue
      }
      if (ch === '\\' && i + 1 < args.length) {
        const next = args[i + 1]!
        if (next === quote || next === '\\') {
          current += next
          i += 1
          continue
        }
      }
      current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      tokenStarted = true
      continue
    }

    if (/\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += ch
    tokenStarted = true
  }

  if (quote) {
    return { args: tokens, error: 'Unterminated quoted string in /budget arguments.' }
  }

  if (tokenStarted) tokens.push(current)
  return { args: tokens }
}

function usage(error?: string): string {
  const lines = [
    'Budget',
    '',
    'Usage:',
    '  /budget',
    '  /budget set <provider> <usd>',
    '  /budget set global <usd>',
    '  /budget reset',
    '',
    'Examples:',
    '  /budget set minimax 5.00',
    '  /budget set global 20.00',
    '  /budget reset',
  ]
  return error ? `${error}\n\n${lines.join('\n')}` : lines.join('\n')
}

function formatUsd(amount: number): string {
  return amount === Number.POSITIVE_INFINITY ? 'unlimited' : `$${amount.toFixed(2)}`
}

function isProviderId(value: string, providers: ProviderId[]): value is ProviderId {
  return providers.includes(value as ProviderId)
}

function renderBudgetStatus(): string {
  const deps = getBudgetDeps()
  const state = deps.getBudgetState()
  const providers = deps.getProvidersByCost().map(entry => entry.provider)
  const lines = [
    'Budget tracker',
    '-'.repeat(40),
    `Global remaining: ${formatUsd(deps.getGlobalRemainingBudget())} / $${state.globalDailyBudgetUsd.toFixed(2)}`,
    '',
    'Per-provider daily budgets:',
  ]

  for (const provider of providers) {
    const settings = state.providerSettings[provider]
    if (!settings) continue
    const spend = state.dailySpend[provider]?.spentUsd ?? 0
    lines.push(
      `- ${provider}: spent $${spend.toFixed(2)} / ${formatUsd(settings.dailyBudgetUsd)}${settings.enabled ? '' : ' (disabled)'}`,
    )
  }

  lines.push('')
  lines.push('State: ~/.duckhive/budget-state.json')
  lines.push('Log: ~/.duckhive/budget-log.jsonl')
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args: string) => {
  const parsed = splitCommandArgs(args)
  if (parsed.error) {
    return { type: 'text', value: usage(parsed.error) }
  }
  const tokens = parsed.args
  const subcommand = tokens[0]?.toLowerCase() ?? 'status'
  const providers = getBudgetDeps().getProvidersByCost().map(entry => entry.provider)

  if (subcommand === 'status') {
    if (tokens.length > 1) {
      return { type: 'text', value: usage('status does not accept extra arguments.') }
    }
    return { type: 'text', value: renderBudgetStatus() }
  }

  if (subcommand === 'reset') {
    if (tokens.length > 1) {
      return { type: 'text', value: usage('reset does not accept extra arguments.') }
    }
    getBudgetDeps().resetAllSpend()
    return { type: 'text', value: 'Budget spend counters reset.' }
  }

  if (subcommand === 'set') {
    const target = tokens[1]?.toLowerCase()
    const rawAmount = tokens[2]
    if (!target || !rawAmount || tokens.length > 3) {
      return { type: 'text', value: usage('set requires a target and USD amount.') }
    }
    const amount = Number(rawAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      return { type: 'text', value: usage(`Invalid USD amount: ${rawAmount}`) }
    }

    if (target === 'global') {
      getBudgetDeps().setGlobalBudget(amount)
      return {
        type: 'text',
        value: `Global daily budget set to $${amount.toFixed(2)}.`,
      }
    }

    if (!isProviderId(target, providers)) {
      return { type: 'text', value: usage(`Unknown provider: ${target}`) }
    }

    getBudgetDeps().setProviderBudget(target, { dailyBudgetUsd: amount })
    return {
      type: 'text',
      value: `${target} daily budget set to $${amount.toFixed(2)}.`,
    }
  }

  return { type: 'text', value: usage(`Unknown budget action: ${subcommand}`) }
}
