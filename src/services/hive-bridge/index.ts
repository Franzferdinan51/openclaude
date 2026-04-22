/**
 * Hive Nation Bridge - Integration index
 * Re-exports all public types and the bridge singleton
 */

export {
  HiveBridge,
  getHiveBridge,
  initHiveBridge,
} from './hive-bridge.js'

export type {
  HiveConfig,
  HiveHealth,
  Councilor,
  DeliberationSession,
  DeliberationMessage,
  DeliberationMode,
  Decree,
  Team,
  TeamTemplate,
  TeamRole,
  TeamTask,
  AskRequest,
  AskResponse,
  HiveContext,
  IntegrationOptions,
} from './hive-types.js'
