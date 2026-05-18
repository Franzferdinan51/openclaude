/**
 * DuckCustodian Dialogue — resolves fuzzy commands to typed operations.
 * Mirrors OpenClaw's Crestodian dialogue pattern.
 *
 * When the user types something that doesn't match a known command,
 * the dialogue module can ask an LLM planner (assistant) to interpret it.
 *
 * The flow:
 *   parseDuckCustodianOperation(input) → op (deterministic)
 *   If op.kind === 'none' and input is non-empty → ask assistant to plan
 *   assistant returns a command string → re-parse → return typed op
 */
import type { DuckCustodianOverview } from './overview.js';

// ---------------------------------------------------------------------------
// Approval question for persistent operations
// ---------------------------------------------------------------------------

export function duckCustodianApprovalQuestion(op: ReturnType<typeof import('./operations.js').parseDuckCustodianOperation>): string {
  const { describeDuckCustodianOperation } = require('./operations.js');
  return `Apply this operation: ${describeDuckCustodianOperation(op)}?`;
}

export function isYes(input: string): boolean {
  return /^(y|yes|apply|do it|approved?)$/i.test(input.trim());
}

// ---------------------------------------------------------------------------
// Assistant planner — used for fuzzy command interpretation
// ---------------------------------------------------------------------------

export type DuckCustodianAssistantPlan = {
  command: string;
  reply?: string;
  modelLabel?: string;
};

export type DuckCustodianAssistantPlanner = (params: {
  input: string;
  overview: DuckCustodianOverview;
}) => Promise<DuckCustodianAssistantPlan | null>;

// ---------------------------------------------------------------------------
// Resolve operation — deterministic parse first, then ask assistant
// for unknown commands
// ---------------------------------------------------------------------------

export async function resolveDuckCustodianOperation(
  input: string,
  opts: {
    loadOverview?: () => Promise<DuckCustodianOverview>;
    planWithAssistant?: DuckCustodianAssistantPlanner;
  } = {},
): Promise<ReturnType<typeof import('./operations.js').parseDuckCustodianOperation>> {
  const { parseDuckCustodianOperation } = require('./operations.js');

  const operation = parseDuckCustodianOperation(input);
  if (!shouldAskAssistant(input, operation)) {
    return operation;
  }

  const overview = await (opts.loadOverview?.() ?? (async () => {
    const { loadDuckCustodianOverview } = await import('./overview.js');
    return loadDuckCustodianOverview();
  })());

  const planner = opts.planWithAssistant ?? defaultAssistantPlanner;
  const plan = await planner({ input, overview });
  if (!plan) {
    return operation;
  }

  const planned = parseDuckCustodianOperation(plan.command);
  if (planned.kind === 'none') {
    return operation;
  }

  return planned;
}

function shouldAskAssistant(
  input: string,
  operation: ReturnType<typeof import('./operations.js').parseDuckCustodianOperation>,
): boolean {
  // Only ask assistant for unrecognized commands
  if (operation.kind !== 'none') {
    return false;
  }
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed === 'quit' || trimmed === 'exit') {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Default assistant planner — uses mmx if available
// ---------------------------------------------------------------------------

async function defaultAssistantPlanner(
  params: { input: string; overview: DuckCustodianOverview },
): Promise<DuckCustodianAssistantPlan | null> {
  // DuckHive can extend this to use mmx for fuzzy command interpretation
  // For now, return null to indicate no plan was generated
  return null;
}

// ---------------------------------------------------------------------------
// Format assistant plan for display
// ---------------------------------------------------------------------------

export function formatDuckCustodianAssistantPlan(plan: DuckCustodianAssistantPlan): string {
  const lines: string[] = [];
  if (plan.modelLabel) {
    lines.push(`[duckcustodian] planner: ${plan.modelLabel}`);
  }
  if (plan.reply) {
    lines.push(plan.reply);
  }
  lines.push(`[duckcustodian] interpreted: ${plan.command}`);
  return lines.join('\n');
}