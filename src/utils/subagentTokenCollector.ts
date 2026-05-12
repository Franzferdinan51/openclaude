/**
 * Subagent Token Collector
 * Tracks per-subagent token usage with configurable hard limits.
 * Inspired by DeerFlow's SubagentTokenCollector.
 */

import { randomUUID } from "crypto";

export interface SubagentTokenUsage {
  taskId: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  limit: number;
  startedAt: number;
  endedAt?: number;
  status: SubagentStatus;
}

export enum SubagentStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMED_OUT = "timed_out",
}

const DEFAULT_TOKEN_LIMIT = 100_000; // 100k tokens per subagent

interface CollectorConfig {
  defaultLimit: number;
  onLimitExceeded?: (usage: SubagentTokenUsage) => void;
  onStatusChange?: (usage: SubagentTokenUsage) => void;
}

const DEFAULT_CONFIG: CollectorConfig = {
  defaultLimit: DEFAULT_TOKEN_LIMIT,
};

/**
 * Global token collector registry.
 * Singleton per process to track all active subagent token usage.
 */
class SubagentTokenCollectorRegistry {
  private static instance: SubagentTokenCollectorRegistry | null = null;
  private tasks: Map<string, SubagentTokenUsage> = new Map();
  private config: CollectorConfig;

  private constructor(config: CollectorConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  static getInstance(config?: CollectorConfig): SubagentTokenCollectorRegistry {
    if (!SubagentTokenCollectorRegistry.instance) {
      SubagentTokenCollectorRegistry.instance = new SubagentTokenCollectorRegistry(config);
    }
    return SubagentTokenCollectorRegistry.instance;
  }

  static resetInstance(): void {
    SubagentTokenCollectorRegistry.instance = null;
  }

  /**
   * Create a new token tracking entry for a subagent task.
   */
  createTask(agentId: string, customLimit?: number): SubagentTokenUsage {
    const taskId = randomUUID();
    const limit = customLimit ?? this.config.defaultLimit;
    const usage: SubagentTokenUsage = {
      taskId,
      agentId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      limit,
      startedAt: Date.now(),
      status: SubagentStatus.PENDING,
    };
    this.tasks.set(taskId, usage);
    this.updateStatus(taskId, SubagentStatus.RUNNING);
    return usage;
  }

  /**
   * Get usage for a specific task.
   */
  getUsage(taskId: string): SubagentTokenUsage | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Record token usage for a task (called after each model call).
   */
  recordUsage(taskId: string, inputTokens: number, outputTokens: number): void {
    const usage = this.tasks.get(taskId);
    if (!usage) return;

    usage.inputTokens += inputTokens;
    usage.outputTokens += outputTokens;
    usage.totalTokens = usage.inputTokens + usage.outputTokens;

    // Check limit
    if (usage.totalTokens >= usage.limit) {
      this.config.onLimitExceeded?.(usage);
    }
  }

  /**
   * Update status of a task.
   */
  updateStatus(taskId: string, status: SubagentStatus): void {
    const usage = this.tasks.get(taskId);
    if (!usage) return;

    const oldStatus = usage.status;
    usage.status = status;

    if (status === SubagentStatus.COMPLETED || status === SubagentStatus.FAILED ||
        status === SubagentStatus.CANCELLED || status === SubagentStatus.TIMED_OUT) {
      usage.endedAt = Date.now();
    }

    if (oldStatus !== status) {
      this.config.onStatusChange?.(usage);
    }
  }

  /**
   * Check if a task has exceeded its token limit.
   */
  isOverLimit(taskId: string): boolean {
    const usage = this.tasks.get(taskId);
    return usage ? usage.totalTokens >= usage.limit : false;
  }

  /**
   * Get remaining budget for a task.
   */
  getRemainingBudget(taskId: string): number {
    const usage = this.tasks.get(taskId);
    if (!usage) return 0;
    return Math.max(0, usage.limit - usage.totalTokens);
  }

  /**
   * Get all tracked tasks.
   */
  getAllTasks(): SubagentTokenUsage[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status.
   */
  getTasksByStatus(status: SubagentStatus): SubagentTokenUsage[] {
    return this.getAllTasks().filter((t) => t.status === status);
  }

  /**
   * Clean up completed/failed tasks older than given ms.
   */
  prune(olderThanMs: number = 30 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs;
    let pruned = 0;
    for (const [taskId, usage] of this.tasks) {
      if (usage.endedAt && usage.endedAt < cutoff) {
        this.tasks.delete(taskId);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Cancel a task (marks as cancelled, records end time).
   */
  cancelTask(taskId: string): boolean {
    const usage = this.tasks.get(taskId);
    if (!usage) return false;
    this.updateStatus(taskId, SubagentStatus.CANCELLED);
    return true;
  }
}

/**
 * Create a new token collector with optional config.
 */
export function createTokenCollector(config?: Partial<CollectorConfig>): SubagentTokenCollectorRegistry {
  return SubagentTokenCollectorRegistry.getInstance({ ...DEFAULT_CONFIG, ...config });
}

/**
 * Get the default singleton collector.
 */
export function getTokenCollector(): SubagentTokenCollectorRegistry {
  return SubagentTokenCollectorRegistry.getInstance();
}

/**
 * Convenience: start tracking a new subagent task.
 */
export function trackSubagentTask(agentId: string, customLimit?: number): SubagentTokenUsage {
  return getTokenCollector().createTask(agentId, customLimit);
}

/**
 * Convenience: record tokens used by a subagent.
 */
export function recordSubagentTokens(taskId: string, inputTokens: number, outputTokens: number): void {
  getTokenCollector().recordUsage(taskId, inputTokens, outputTokens);
}

/**
 * Convenience: check if subagent exceeded its token budget.
 */
export function isSubagentOverBudget(taskId: string): boolean {
  return getTokenCollector().isOverLimit(taskId);
}

/**
 * Convenience: get subagent status.
 */
export function getSubagentStatus(taskId: string): SubagentStatus | undefined {
  return getTokenCollector().getUsage(taskId)?.status;
}

/**
 * Convenience: complete a subagent task.
 */
export function completeSubagentTask(taskId: string): void {
  getTokenCollector().updateStatus(taskId, SubagentStatus.COMPLETED);
}

export { SubagentTokenCollectorRegistry };
export default getTokenCollector;
