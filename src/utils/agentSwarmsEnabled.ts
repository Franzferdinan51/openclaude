import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import { isEnvDefinedFalsy, isEnvTruthy } from './envUtils.js'

/**
 * Centralized runtime check for agent teams/teammate features.
 * This is the single gate that should be checked everywhere teammates
 * are referenced (prompts, code, tools isEnabled, UI, etc.).
 *
 * DuckHive enables local agent teams by default, and the local GrowthBook stub
 * can disable the feature through the existing killswitch for emergency
 * rollback.
 */
export function isAgentSwarmsEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.DUCKHIVE_AGENT_TEAMS_ENABLED)) {
    return false
  }

  if (isEnvTruthy(process.env.DUCKHIVE_AGENT_TEAMS_ENABLED)) {
    return true
  }

  if (process.env.USER_TYPE === 'ant') {
    return true
  }

  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_amber_flint', true)
}
