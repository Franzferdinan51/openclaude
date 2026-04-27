/**
 * DuckCustodian Audit Log — tracks all applied persistent operations.
 * Mirrors OpenClaw's Crestodian audit: JSONL file, one entry per line.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { getClaudeConfigHomeDir } from '../utils/envUtils.js';

export type DuckCustodianAuditEntry = {
  timestamp: string;
  operation: string;
  summary: string;
  details?: Record<string, unknown>;
};

export function resolveDuckCustodianAuditPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.DUCKHIVE_CONFIG_DIR ?? getClaudeConfigHomeDir();
  return path.join(base, 'audit', 'duckcustodian.jsonl');
}

export async function appendDuckCustodianAuditEntry(
  entry: Omit<DuckCustodianAuditEntry, 'timestamp'>,
  opts: { env?: NodeJS.ProcessEnv; auditPath?: string } = {},
): Promise<string> {
  const auditPath = opts.auditPath ?? resolveDuckCustodianAuditPath(opts.env);
  await fs.mkdir(path.dirname(auditPath), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  } satisfies DuckCustodianAuditEntry);
  await fs.appendFile(auditPath, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
  return auditPath;
}

export async function readDuckCustodianAuditEntries(
  limit = 50,
  opts: { env?: NodeJS.ProcessEnv; auditPath?: string } = {},
): Promise<DuckCustodianAuditEntry[]> {
  const auditPath = opts.auditPath ?? resolveDuckCustodianAuditPath(opts.env);
  try {
    const content = await fs.readFile(auditPath, { encoding: 'utf8' });
    const lines = content.trim().split('\n').filter(Boolean).slice(-limit);
    return lines.map((line) => {
      try {
        return JSON.parse(line) as DuckCustodianAuditEntry;
      } catch {
        return null;
      }
    }).filter(Boolean) as DuckCustodianAuditEntry[];
  } catch {
    return [];
  }
}
