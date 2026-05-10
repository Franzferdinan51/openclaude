import * as React from 'react'

import { ProviderManager, type ProviderManagerResult } from '../../components/ProviderManager.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'

function formatOnboardResult(result?: ProviderManagerResult): string {
  if (!result || result.action === 'cancelled') {
    return 'DuckHive onboarding cancelled. Run /onboard anytime to finish setup.'
  }

  if (result.action === 'activated') {
    const model = result.activeProviderModel
      ? ` using ${result.activeProviderModel}`
      : ''
    return `DuckHive provider ready: ${result.activeProviderName ?? 'active provider'}${model}.`
  }

  return result.message ?? 'DuckHive provider profile saved.'
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args?: string,
): Promise<React.ReactNode> {
  return (
    <ProviderManager
      mode="first-run"
      onDone={result => {
        onDone(formatOnboardResult(result), {
          display: 'system',
          metaMessages:
            result?.action === 'activated' && result.activeProviderName
              ? [
                  `<system-reminder>DuckHive onboarding activated ${result.activeProviderName}${
                    result.activeProviderModel
                      ? ` using model ${result.activeProviderModel}`
                      : ''
                  }. Use this provider/model for subsequent requests unless the user switches again.</system-reminder>`,
                ]
              : undefined,
        })
      }}
    />
  )
}
