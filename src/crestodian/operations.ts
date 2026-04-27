/**
 * DuckCustodian Operations — typed operations for DuckHive repair/config/bootstrap.
 * Mirrors OpenClaw's Crestodian pattern: deterministic parse → typed op → approval → execute → audit.
 */
import { appendDuckCustodianAuditEntry, resolveDuckCustodianAuditPath } from './audit.js';
import type { DuckCustodianOverview } from './overview.js';

// ---------------------------------------------------------------------------
// Operation types
// ---------------------------------------------------------------------------

export type DuckCustodianOperation =
  | { kind: 'none'; message: string }
  | { kind: 'overview' }
  | { kind: 'doctor' }
  | { kind: 'doctor-fix' }
  | { kind: 'status' }
  | { kind: 'health' }
  | { kind: 'config-validate' }
  | { kind: 'config-set'; key: string; value: string }
  | { kind: 'setup' }
  | { kind: 'mmx-status' }
  | { kind: 'lmstudio-status' }
  | { kind: 'models' }
  | { kind: 'audit' }
  | { kind: 'audit-path' }
  | { kind: 'memory-stats' }
  | { kind: 'memory-scan' }
  | { kind: 'lessons' }
  | { kind: 'inject-memory'; content: string }
  | { kind: 'openclaw-status' }
  | { kind: 'openclaw-restart' };

export type DuckCustodianOperationResult = {
  applied: boolean;
  exitsInteractive?: boolean;
  message?: string;
};

// ---------------------------------------------------------------------------
// Persistent ops need approval
// ---------------------------------------------------------------------------

export function isPersistentDuckCustodianOperation(op: DuckCustodianOperation): boolean {
  switch (op.kind) {
    case 'config-set':
    case 'doctor-fix':
    case 'inject-memory':
    case 'openclaw-restart':
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Description for approval prompt
// ---------------------------------------------------------------------------

export function describeDuckCustodianOperation(op: DuckCustodianOperation): string {
  switch (op.kind) {
    case 'none':
      return `No operation recognized: "${op.message}"`;
    case 'overview':
      return 'Show system overview';
    case 'doctor':
      return 'Run diagnostics (read-only)';
    case 'doctor-fix':
      return 'Run diagnostics and apply repairs';
    case 'status':
      return 'Show detailed status';
    case 'health':
      return 'Run health probes';
    case 'config-validate':
      return 'Validate config file';
    case 'config-set':
      return `Set config: ${op.key} = ${op.value}`;
    case 'setup':
      return 'Run setup bootstrap';
    case 'mmx-status':
      return 'Check MiniMax CLI (mmx) status';
    case 'lmstudio-status':
      return 'Check LM Studio status';
    case 'models':
      return 'List available models';
    case 'audit':
      return 'Show recent audit log';
    case 'audit-path':
      return 'Show audit log path';
    case 'memory-stats':
      return 'Show memory layer statistics';
    case 'memory-scan':
      return 'Scan for memory insights';
    case 'lessons':
      return 'Show lessons from past failures';
    case 'inject-memory':
      return `Inject memory: ${op.content.slice(0, 60)}...`;
    case 'openclaw-status':
      return 'Check OpenClaw gateway status';
    case 'openclaw-restart':
      return 'Restart OpenClaw gateway';
  }
}

// ---------------------------------------------------------------------------
// Command parser — deterministic, no LLM needed
// ---------------------------------------------------------------------------

const COMMAND_RE = /^\s*([\w-]+)\s*(.*)$/s;

export function parseDuckCustodianOperation(input: string): DuckCustodianOperation {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed === 'quit' || trimmed === 'exit') {
    return { kind: 'none', message: '' };
  }

  const match = trimmed.match(COMMAND_RE);
  if (!match) return { kind: 'none', message: input };

  const [, cmd, rest] = match;
  const args = rest.trim();

  switch (cmd) {
    case 'help':
    case '?':
    case 'overview':
    case '':
      return { kind: 'overview' };

    case 'status':
      return { kind: 'status' };

    case 'health':
    case 'probes':
      return { kind: 'health' };

    case 'doctor':
      return args === 'fix' ? { kind: 'doctor-fix' } : { kind: 'doctor' };

    case 'validate':
    case 'validate-config':
    case 'config-validate':
      return { kind: 'config-validate' };

    case 'set':
    case 'config-set':
    case 'config': {
      // "set key value" or "config set key value"
      const parts = args.split(/\s+/);
      if (parts.length >= 2) {
        return { kind: 'config-set', key: parts[0], value: parts.slice(1).join(' ') };
      }
      return { kind: 'none', message: `Usage: set <key> <value>` };
    }

    case 'setup':
    case 'bootstrap':
      return { kind: 'setup' };

    case 'mmx':
    case 'mmx-status':
      return { kind: 'mmx-status' };

    case 'lmstudio':
    case 'lm-studio':
    case 'lmstudio-status':
      return { kind: 'lmstudio-status' };

    case 'models':
    case 'list-models':
      return { kind: 'models' };

    case 'audit':
      return { kind: 'audit' };

    case 'audit-path':
      return { kind: 'audit-path' };

    case 'memory':
    case 'memory-stats':
      return { kind: 'memory-stats' };

    case 'memory-scan':
    case 'scan-memory':
      return { kind: 'memory-scan' };

    case 'lessons':
    case 'learn':
      return { kind: 'lessons' };

    case 'inject':
    case 'inject-memory':
      if (args.length > 0) {
        return { kind: 'inject-memory', content: args };
      }
      return { kind: 'none', message: 'Usage: inject-memory <content>' };

    case 'openclaw':
    case 'openclaw-status':
      return { kind: 'openclaw-status' };

    case 'openclaw-restart':
    case 'restart-openclaw':
      return { kind: 'openclaw-restart' };

    default:
      return { kind: 'none', message: input };
  }
}

// ---------------------------------------------------------------------------
// Operation executor
// ---------------------------------------------------------------------------

export interface DuckCustodianDeps {
  loadOverview: () => Promise<DuckCustodianOverview>;
  formatOverview: (overview: DuckCustodianOverview) => string;
  runDoctor?: () => Promise<void>;
  runDoctorFix?: () => Promise<void>;
  validateConfig?: () => Promise<{ valid: boolean; errors: string[] }>;
  checkMmx?: () => Promise<{ found: boolean; version?: string; error?: string }>;
  checkLmStudio?: () => Promise<{ found: boolean; models: string[]; error?: string }>;
  checkOpenClaw?: () => Promise<{ reachable: boolean; version?: string; error?: string }>;
  restartOpenClaw?: () => Promise<void>;
  getMemoryStats?: () => Promise<{ memories: number; lessons: number; recent: string[] }>;
  scanMemory?: () => Promise<string[]>;
  getLessons?: () => Promise<string[]>;
  injectMemory?: (content: string) => Promise<void>;
}

export async function executeDuckCustodianOperation(
  op: DuckCustodianOperation,
  deps: DuckCustodianDeps,
  opts: { approved: boolean } = { approved: false },
): Promise<{ message: string; applied: boolean }> {
  const approved = opts.approved;

  // Persistent operations need approval
  if (isPersistentDuckCustodianOperation(op) && !approved) {
    return {
      applied: false,
      message: `Requires approval: ${describeDuckCustodianOperation(op)}\nReply with --yes to apply.`,
    };
  }

  switch (op.kind) {
    case 'none':
      return { applied: false, message: op.message || 'No operation.' };

    case 'overview': {
      const overview = await deps.loadOverview();
      return { applied: false, message: deps.formatOverview(overview) };
    }

    case 'status': {
      const overview = await deps.loadOverview();
      return { applied: false, message: deps.formatOverview(overview) };
    }

    case 'health': {
      const checks: string[] = [];
      if (deps.checkMmx) {
        const r = await deps.checkMmx();
        checks.push(`mmx: ${r.found ? `✅ ${r.version ?? 'found'}` : '❌ not found'}`);
      }
      if (deps.checkLmStudio) {
        const r = await deps.checkLmStudio();
        checks.push(`LM Studio: ${r.found ? `✅ ${r.models.length} models loaded` : '❌ not reachable'}`);
      }
      if (deps.checkOpenClaw) {
        const r = await deps.checkOpenClaw();
        checks.push(`OpenClaw: ${r.reachable ? `✅ ${r.version ?? 'reachable'}` : '❌ not reachable'}`);
      }
      return { applied: false, message: checks.join('\n') || 'No health checks configured.' };
    }

    case 'doctor': {
      if (deps.runDoctor) {
        await deps.runDoctor();
        return { applied: true, message: 'Doctor run complete.' };
      }
      return { applied: false, message: 'Doctor not configured.' };
    }

    case 'doctor-fix': {
      if (deps.runDoctorFix) {
        await deps.runDoctorFix();
        await appendDuckCustodianAuditEntry({
          operation: 'doctor-fix',
          summary: 'Ran doctor with auto-fix',
        });
        return { applied: true, message: 'Doctor fix applied.' };
      }
      return { applied: false, message: 'Doctor fix not configured.' };
    }

    case 'config-validate': {
      if (deps.validateConfig) {
        const r = await deps.validateConfig();
        return {
          applied: false,
          message: r.valid
            ? '✅ Config is valid'
            : `❌ Config has ${r.errors.length} error(s):\n${r.errors.join('\n')}`,
        };
      }
      return { applied: false, message: 'Config validation not configured.' };
    }

    case 'config-set':
      return { applied: false, message: `Config set not implemented in this context. Set: ${op.key} = ${op.value}` };

    case 'setup':
      return {
        applied: false,
        message:
          'Run `duckcustodian setup` interactively or see docs.\nSetup configures API keys, workspace, and default model.',
      };

    case 'mmx-status': {
      if (!deps.checkMmx) return { applied: false, message: 'mmx check not configured.' };
      const r = await deps.checkMmx();
      return {
        applied: false,
        message: r.found
          ? `✅ mmx found: ${r.version ?? 'unknown version'}\n${r.error ? `⚠️ ${r.error}` : ''}`
          : `❌ mmx not found: ${r.error ?? 'unknown error'}`,
      };
    }

    case 'lmstudio-status': {
      if (!deps.checkLmStudio) return { applied: false, message: 'LM Studio check not configured.' };
      const r = await deps.checkLmStudio();
      return {
        applied: false,
        message: r.found
          ? `✅ LM Studio reachable: ${r.models.length} models\n${r.models.slice(0, 5).join(', ')}${r.models.length > 5 ? '...' : ''}`
          : `❌ LM Studio not reachable: ${r.error ?? 'unknown error'}`,
      };
    }

    case 'openclaw-status': {
      if (!deps.checkOpenClaw) return { applied: false, message: 'OpenClaw check not configured.' };
      const r = await deps.checkOpenClaw();
      return {
        applied: false,
        message: r.reachable
          ? `✅ OpenClaw reachable: ${r.version ?? 'unknown version'}`
          : `❌ OpenClaw not reachable: ${r.error ?? 'gateway down'}`,
      };
    }

    case 'openclaw-restart': {
      if (!deps.restartOpenClaw) return { applied: false, message: 'OpenClaw restart not configured.' };
      await deps.restartOpenClaw();
      await appendDuckCustodianAuditEntry({
        operation: 'openclaw-restart',
        summary: 'Restarted OpenClaw gateway',
      });
      return { applied: true, message: '✅ OpenClaw gateway restarted.' };
    }

    case 'models':
      return {
        applied: false,
        message: 'Use `duckcustodian health` to see available models from mmx and LM Studio.',
      };

    case 'audit': {
      const auditPath = resolveDuckCustodianAuditPath();
      return { applied: false, message: `Audit log: ${auditPath}` };
    }

    case 'audit-path':
      return { applied: false, message: resolveDuckCustodianAuditPath() };

    case 'memory-stats': {
      if (!deps.getMemoryStats) return { applied: false, message: 'Memory stats not configured.' };
      const stats = await deps.getMemoryStats();
      return {
        applied: false,
        message: `Memory stats:\n- Memories: ${stats.memories}\n- Lessons: ${stats.lessons}\n- Recent: ${stats.recent.join(', ') || 'none'}`,
      };
    }

    case 'memory-scan': {
      if (!deps.scanMemory) return { applied: false, message: 'Memory scan not configured.' };
      const insights = await deps.scanMemory();
      return {
        applied: false,
        message: insights.length > 0
          ? `Memory insights:\n${insights.map(i => `• ${i}`).join('\n')}`
          : 'No new memory insights found.',
      };
    }

    case 'lessons': {
      if (!deps.getLessons) return { applied: false, message: 'Lessons not configured.' };
      const lessons = await deps.getLessons();
      return {
        applied: false,
        message: lessons.length > 0
          ? `Past failure lessons (${lessons.length}):\n${lessons.slice(0, 10).map(l => `• ${l}`).join('\n')}`
          : 'No lessons recorded yet.',
      };
    }

    case 'inject-memory': {
      if (!deps.injectMemory) return { applied: false, message: 'Memory injection not configured.' };
      await deps.injectMemory(op.content);
      await appendDuckCustodianAuditEntry({
        operation: 'inject-memory',
        summary: `Injected memory: ${op.content.slice(0, 80)}`,
      });
      return { applied: true, message: '✅ Memory injected.' };
    }
  }
}
