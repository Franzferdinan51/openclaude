/**
 * Subagent Lifecycle Registry
 * Comprehensive lifecycle management for spawned subagents.
 * Inspired by DeerFlow's subagent registry with full status tracking,
 * token collection, and cleanup hooks.
 */

import { randomUUID } from "crypto";
import { emitSessionLifecycleEvent } from "../session-lifecycle/session-lifecycle.js";

export enum SubagentStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMED_OUT = "timed_out",
}

export interface SubagentMetadata {
  taskId: string;
  name: string;
  teamName?: string;
  model?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  status: SubagentStatus;
  reason?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  traceId?: string;
  agentId?: string;
}

export interface SubagentRegistryConfig {
  maxConcurrent: number;
  maxTotal: number;
  cleanupIntervalMs: number;
  maxAgeMs: number;
  onStatusChange?: (meta: SubagentMetadata) => void;
  onLimitReached?: (kind: "concurrent" | "total") => void;
}

const DEFAULT_CONFIG: SubagentRegistryConfig = {
  maxConcurrent: 10,
  maxTotal: 100,
  cleanupIntervalMs: 60_000,
  maxAgeMs: 60 * 60 * 1000, // 1 hour
};

class SubagentRegistry {
  private static instance: SubagentRegistry | null = null;
  private agents: Map<string, SubagentMetadata> = new Map();
  private config: SubagentRegistryConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(config: SubagentRegistryConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<SubagentRegistryConfig>): SubagentRegistry {
    if (!SubagentRegistry.instance) {
      SubagentRegistry.instance = new SubagentRegistry({ ...DEFAULT_CONFIG, ...config });
    }
    return SubagentRegistry.instance;
  }

  static resetInstance(): void {
    if (SubagentRegistry.instance?.cleanupTimer) {
      clearInterval(SubagentRegistry.instance.cleanupTimer);
    }
    SubagentRegistry.instance = null;
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.prune();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Register a new subagent task (returns taskId).
   */
  register(params: {
    name: string;
    teamName?: string;
    model?: string;
    agentId?: string;
    traceId?: string;
  }): string {
    const taskId = randomUUID();
    const now = Date.now();

    const meta: SubagentMetadata = {
      taskId,
      name: params.name,
      teamName: params.teamName,
      model: params.model,
      agentId: params.agentId,
      traceId: params.traceId,
      createdAt: now,
      status: SubagentStatus.PENDING,
    };

    this.agents.set(taskId, meta);

    // Check limits
    const runningCount = this.getRunningCount();
    if (runningCount >= this.config.maxConcurrent) {
      this.config.onLimitReached?.("concurrent");
    }
    if (this.agents.size >= this.config.maxTotal) {
      this.config.onLimitReached?.("total");
    }

    return taskId;
  }

  /**
   * Start a registered subagent (transition from PENDING to RUNNING).
   */
  start(taskId: string): boolean {
    const meta = this.agents.get(taskId);
    if (!meta) return false;

    meta.status = SubagentStatus.RUNNING;
    meta.startedAt = Date.now();
    this.config.onStatusChange?.(meta);

    emitSessionLifecycleEvent({
      sessionKey: meta.taskId,
      reason: 'subagent_started',
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Complete a subagent (transition to COMPLETED).
   */
  complete(taskId: string, result?: { reason?: string; tokenUsage?: SubagentMetadata["tokenUsage"] }): boolean {
    const meta = this.agents.get(taskId);
    if (!meta) return false;

    meta.status = SubagentStatus.COMPLETED;
    meta.endedAt = Date.now();
    if (result?.reason) meta.reason = result.reason;
    if (result?.tokenUsage) meta.tokenUsage = result.tokenUsage;

    this.config.onStatusChange?.(meta);
    this.emitEndEvent(meta);
    return true;
  }

  /**
   * Fail a subagent (transition to FAILED).
   */
  fail(taskId: string, reason: string): boolean {
    const meta = this.agents.get(taskId);
    if (!meta) return false;

    meta.status = SubagentStatus.FAILED;
    meta.endedAt = Date.now();
    meta.reason = reason;

    this.config.onStatusChange?.(meta);
    this.emitEndEvent(meta);
    return true;
  }

  /**
   * Cancel a subagent.
   */
  cancel(taskId: string, reason?: string): boolean {
    const meta = this.agents.get(taskId);
    if (!meta) return false;

    meta.status = SubagentStatus.CANCELLED;
    meta.endedAt = Date.now();
    if (reason) meta.reason = reason;

    this.config.onStatusChange?.(meta);
    this.emitEndEvent(meta);
    return true;
  }

  /**
   * Mark a subagent as timed out.
   */
  timeout(taskId: string): boolean {
    const meta = this.agents.get(taskId);
    if (!meta) return false;

    meta.status = SubagentStatus.TIMED_OUT;
    meta.endedAt = Date.now();
    meta.reason = "Execution timed out";

    this.config.onStatusChange?.(meta);
    this.emitEndEvent(meta);
    return true;
  }

  /**
   * Get metadata for a specific task.
   */
  get(taskId: string): SubagentMetadata | undefined {
    return this.agents.get(taskId);
  }

  /**
   * Get all agents.
   */
  getAll(): SubagentMetadata[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by status.
   */
  getByStatus(status: SubagentStatus): SubagentMetadata[] {
    return this.getAll().filter((a) => a.status === status);
  }

  /**
   * Get count of running agents.
   */
  getRunningCount(): number {
    return this.getByStatus(SubagentStatus.RUNNING).length;
  }

  /**
   * Get all agents for a specific team.
   */
  getByTeam(teamName: string): SubagentMetadata[] {
    return this.getAll().filter((a) => a.teamName === teamName);
  }

  /**
   * Check if a specific agent is running.
   */
  isRunning(taskId: string): boolean {
    const meta = this.agents.get(taskId);
    return meta?.status === SubagentStatus.RUNNING;
  }

  /**
   * Get duration of a task in ms.
   */
  getDuration(taskId: string): number | undefined {
    const meta = this.agents.get(taskId);
    if (!meta?.startedAt) return undefined;
    const end = meta.endedAt ?? Date.now();
    return end - meta.startedAt;
  }

  /**
   * Prune old completed/failed agents.
   */
  prune(olderThanMs?: number): number {
    const cutoff = Date.now() - (olderThanMs ?? this.config.maxAgeMs);
    let pruned = 0;

    for (const [taskId, meta] of this.agents) {
      const endTime = meta.endedAt ?? meta.createdAt;
      if (endTime < cutoff && meta.status !== SubagentStatus.RUNNING && meta.status !== SubagentStatus.PENDING) {
        this.agents.delete(taskId);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Cancel all running agents.
   */
  cancelAll(reason?: string): number {
    let cancelled = 0;
    for (const [taskId, meta] of this.agents) {
      if (meta.status === SubagentStatus.RUNNING || meta.status === SubagentStatus.PENDING) {
        this.cancel(taskId, reason);
        cancelled++;
      }
    }
    return cancelled;
  }

  /**
   * Get registry statistics.
   */
  getStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    pending: number;
    cancelled: number;
    timedOut: number;
    avgDurationMs?: number;
  } {
    const all = this.getAll();
    const completed = all.filter((a) => a.status === SubagentStatus.COMPLETED && a.startedAt && a.endedAt);
    const durations = completed.map((a) => (a.endedAt! - a.startedAt!)).filter((d) => d > 0);
    const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;

    return {
      total: all.length,
      running: all.filter((a) => a.status === SubagentStatus.RUNNING).length,
      completed: all.filter((a) => a.status === SubagentStatus.COMPLETED).length,
      failed: all.filter((a) => a.status === SubagentStatus.FAILED).length,
      pending: all.filter((a) => a.status === SubagentStatus.PENDING).length,
      cancelled: all.filter((a) => a.status === SubagentStatus.CANCELLED).length,
      timedOut: all.filter((a) => a.status === SubagentStatus.TIMED_OUT).length,
      avgDurationMs,
    };
  }

  private emitEndEvent(meta: SubagentMetadata): void {
    const reason = meta.status === SubagentStatus.COMPLETED
      ? 'subagent_completed'
      : meta.status === SubagentStatus.FAILED
        ? 'subagent_failed'
        : meta.status === SubagentStatus.CANCELLED
          ? 'subagent_cancelled'
          : meta.status === SubagentStatus.TIMED_OUT
            ? 'subagent_timed_out'
            : `subagent_${meta.status}`;

    emitSessionLifecycleEvent({
      sessionKey: meta.taskId,
      reason,
      timestamp: Date.now(),
    });
  }
}

export function getSubagentRegistry(config?: Partial<SubagentRegistryConfig>): SubagentRegistry {
  return SubagentRegistry.getInstance(config);
}

export function createSubagentRegistry(config?: Partial<SubagentRegistryConfig>): SubagentRegistry {
  return SubagentRegistry.getInstance(config);
}

export function registerSubagent(params: {
  name: string;
  teamName?: string;
  model?: string;
  agentId?: string;
  traceId?: string;
}): string {
  return SubagentRegistry.getInstance().register(params);
}

export function startSubagent(taskId: string): boolean {
  return SubagentRegistry.getInstance().start(taskId);
}

export function completeSubagent(taskId: string, result?: { reason?: string; tokenUsage?: SubagentMetadata["tokenUsage"] }): boolean {
  return SubagentRegistry.getInstance().complete(taskId, result);
}

export function failSubagent(taskId: string, reason: string): boolean {
  return SubagentRegistry.getInstance().fail(taskId, reason);
}

export function cancelSubagent(taskId: string, reason?: string): boolean {
  return SubagentRegistry.getInstance().cancel(taskId, reason);
}

export function timeoutSubagent(taskId: string): boolean {
  return SubagentRegistry.getInstance().timeout(taskId);
}

export function getSubagentMetadata(taskId: string): SubagentMetadata | undefined {
  return SubagentRegistry.getInstance().get(taskId);
}

export default SubagentRegistry;
