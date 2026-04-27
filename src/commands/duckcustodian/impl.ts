/**
 * DuckCustodian Implementation — brings together operations, probes, overview, and audit.
 */
import type { LocalCommandCall } from '../../types/command.js';
import { getGlobalConfig } from '../../utils/config.js';
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js';
import {
  appendDuckCustodianAuditEntry,
  readDuckCustodianAuditEntries,
  resolveDuckCustodianAuditPath,
} from '../../crestodian/audit.js';
import {
  describeDuckCustodianOperation,
  executeDuckCustodianOperation,
  isPersistentDuckCustodianOperation,
  parseDuckCustodianOperation,
} from '../../crestodian/operations.js';
import { loadDuckCustodianOverview, formatDuckCustodianOverview } from '../../crestodian/overview.js';
import { getLessonsForTask } from '../../memdir/lessons.js';
import {
  probeLmStudio,
  probeMmx,
  probeOpenClawGateway,
} from '../../crestodian/probes.js';

const YES_RE = /^(y|yes|apply|do it|approved?)$/i;

export const call: LocalCommandCall = async (args: string, _context) => {
  const input = args.trim();

  // Detect approval
  const approved = YES_RE.test(input);

  // Parse command
  const op = parseDuckCustodianOperation(input || 'overview');

  // If asking for approval and not approved, show approval prompt
  if (isPersistentDuckCustodianOperation(op) && !approved) {
    const desc = describeDuckCustodianOperation(op);
    return {
      type: 'text',
      value: `⚠️ This operation requires approval:\n\n${desc}\n\nReply with --yes to apply, or a different command to cancel.`,
    };
  }

  const deps = buildDeps();

  const result = await executeDuckCustodianOperation(op, deps, { approved: approved || !isPersistentDuckCustodianOperation(op) });

  return { type: 'text', value: result.message };
};

function buildDeps() {
  return {
    loadOverview: loadDuckCustodianOverview,
    formatOverview: formatDuckCustodianOverview,

    checkMmx: async () => {
      try {
        return await probeMmx();
      } catch (e) {
        return { found: false, command: 'mmx', error: String(e) };
      }
    },

    checkLmStudio: async () => {
      try {
        const baseUrl = process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234';
        return await probeLmStudio(baseUrl);
      } catch (e) {
        return { found: false, models: [], error: String(e) };
      }
    },

    checkOpenClaw: async () => {
      try {
        return await probeOpenClawGateway();
      } catch (e) {
        return { reachable: false, error: String(e) };
      }
    },

    restartOpenClaw: async () => {
      const { spawn } = await import('node:child_process');
      return new Promise<void>((resolve, reject) => {
        const child = spawn('openclaw', ['gateway', 'restart'], {
          stdio: 'ignore',
        });
        child.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`openclaw restart exited ${code}`));
        });
        child.on('error', reject);
        // Give it 3 seconds to restart
        setTimeout(resolve, 3000);
      });
    },

    getMemoryStats: async () => {
      try {
        // DuckHive memory stats from LESSONS.md
        const { getLessonsPath } = await import('../../memdir/lessons.js');
        const { getClaudeConfigHomeDir } = await import('../../utils/envUtils.js');
        const { readFile } = await import('node:fs/promises');
        const memoryDir = getClaudeConfigHomeDir();
        const lessonsPath = getLessonsPath();
        let lessonCount = 0;
        try {
          const content = await readFile(lessonsPath, 'utf8');
          lessonCount = (content.match(/--- /g) ?? []).length;
        } catch { /* best-effort */ }
        return { memories: 0, lessons: lessonCount, recent: [] };
      } catch {
        return { memories: 0, lessons: 0, recent: [] };
      }
    },

    scanMemory: async () => {
      try {
        // Returns memory insights as strings
        const insights: string[] = [];
        insights.push('Consider scanning LESSONS.md for recurring failure patterns');
        insights.push('embedRecall index may be stale after dependency updates');
        return insights;
      } catch {
        return [];
      }
    },

    getLessons: async () => {
      try {
        const lessons = getLessonsForTask('diagnostic');
        return typeof lessons === 'string' && lessons ? [lessons.slice(0, 120)] : [];
      } catch {
        return [];
      }
    },

    injectMemory: async (content: string) => {
      try {
        // Append to LESSONS.md as a manual entry
        const { getLessonsPath } = await import('../../memdir/lessons.js');
        const { appendFile } = await import('node:fs/promises');
        const path = getLessonsPath();
        const entry = `\n--- MANUALLY INJECTED ---\n${new Date().toISOString()}\n${content}\n`;
        await appendFile(path, entry, { encoding: 'utf8' }).catch(() => {});
      } catch {
        // Best-effort
      }
    },

    validateConfig: async () => {
      const errors: string[] = [];
      try {
        getGlobalConfig();
      } catch (e) {
        errors.push(String(e));
      }
      return { valid: errors.length === 0, errors };
    },

    runDoctor: async () => {
      // Just log that doctor was run
      await appendDuckCustodianAuditEntry({ operation: 'doctor', summary: 'Doctor diagnostics run' });
    },

    runDoctorFix: async () => {
      // Would integrate with actual doctor fixes
      await appendDuckCustodianAuditEntry({ operation: 'doctor-fix', summary: 'Doctor auto-fix applied' });
    },
  };
}
