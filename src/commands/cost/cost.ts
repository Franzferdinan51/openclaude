import { formatTotalCost } from '../../cost-tracker.js'
import { currentLimits } from '../../services/claudeAiLimits.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isClaudeAISubscriber } from '../../utils/auth.js'

type CostDeps = {
  formatTotalCost: typeof formatTotalCost
  isClaudeAISubscriber: typeof isClaudeAISubscriber
  currentLimits: typeof currentLimits
  userType?: string
}

let testDeps: Partial<CostDeps> | null = null

function getDeps(): CostDeps {
  return {
    formatTotalCost,
    isClaudeAISubscriber,
    currentLimits,
    userType: process.env.USER_TYPE,
    ...testDeps,
  }
}

export function setCostCommandTestDeps(overrides: Partial<CostDeps> | null): void {
  testDeps = overrides
}

export const call: LocalCommandCall = async () => {
  const deps = getDeps()
  if (deps.isClaudeAISubscriber()) {
    let value: string

    if (deps.currentLimits.isUsingOverage) {
      value =
        'You are currently using your overages to power your DuckHive usage. We will automatically switch you back to your subscription rate limits when they reset'
    } else {
      value =
        'You are currently using your subscription to power your DuckHive usage'
    }

    if (deps.userType === 'ant') {
      value += `\n\n[internal-only] Showing cost anyway:\n ${deps.formatTotalCost()}`
    }
    return { type: 'text', value }
  }
  return { type: 'text', value: deps.formatTotalCost() }
}
