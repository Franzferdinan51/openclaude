/**
 * DuckCustodian — DuckHive's self-repair and configuration helper.
 * Pattern from OpenClaw's Crestodian, adapted for DuckHive.
 *
 * Key capabilities:
 * - Deterministic command parser (no LLM needed for routing)
 * - Typed operations with approval requirement for persistent changes
 * - Health probes (mmx, LM Studio, OpenClaw, Git)
 * - JSONL audit trail of all applied operations
 * - Rescue mode for broken states
 * - Memory integration (learn from past failures)
 *
 * Usage:
 *   parseDuckCustodianOperation('health')  → DuckCustodianOperation
 *   executeDuckCustodianOperation(op, deps)
 *
 * DuckHive CLI integration:
 *   /duckcustodian status
 *   /duckcustodian health
 *   /duckcustodian doctor fix
 *   /duckcustodian lessons
 *   /duckcustodian inject-memory <text>
 */
export {
  parseDuckCustodianOperation,
  executeDuckCustodianOperation,
  isPersistentDuckCustodianOperation,
  describeDuckCustodianOperation,
  type DuckCustodianOperation,
  type DuckCustodianOperationResult,
  type DuckCustodianDeps,
} from './operations.js';

export {
  loadDuckCustodianOverview,
  formatDuckCustodianOverview,
  type DuckCustodianOverview,
} from './overview.js';

export {
  appendDuckCustodianAuditEntry,
  readDuckCustodianAuditEntries,
  resolveDuckCustodianAuditPath,
  type DuckCustodianAuditEntry,
} from './audit.js';

export {
  probeLocalCommand,
  probeGatewayUrl,
  probeOpenClawGateway,
  probeLmStudio,
  probeMmx,
  probeOpenClaw,
  probeGit,
  probeNode,
} from './probes.js';
