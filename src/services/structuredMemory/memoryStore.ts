/**
 * Structured Memory Layer
 * Per-user memory with fact extraction, confidence scoring, and injection budget.
 * Inspired by DeerFlow's memory system.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface MemoryStore {
  version: string;
  lastUpdated: string;
  user: {
    workContext: MemorySection;
    personalContext: MemorySection;
    topOfMind: MemorySection;
  };
  history: {
    recentMonths: MemorySection;
    earlierContext: MemorySection;
    longTermBackground: MemorySection;
  };
  facts: Fact[];
}

export interface MemorySection {
  summary: string;
  updatedAt: string;
}

export interface Fact {
  id: string;
  content: string;
  confidence: number; // 0.0 - 1.0
  source?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface StructuredMemoryConfig {
  storagePath: string;
  maxFacts: number;
  factConfidenceThreshold: number;
  maxInjectionTokens: number;
  debounceMs: number;
}

const DEFAULT_CONFIG: StructuredMemoryConfig = {
  storagePath: ".duckhive-memory",
  maxFacts: 100,
  factConfidenceThreshold: 0.7,
  maxInjectionTokens: 2000,
  debounceMs: 30_000,
};

function createEmptyStore(): MemoryStore {
  const now = new Date().toISOString();
  return {
    version: "1.0",
    lastUpdated: now,
    user: {
      workContext: { summary: "", updatedAt: now },
      personalContext: { summary: "", updatedAt: now },
      topOfMind: { summary: "", updatedAt: now },
    },
    history: {
      recentMonths: { summary: "", updatedAt: now },
      earlierContext: { summary: "", updatedAt: now },
      longTermBackground: { summary: "", updatedAt: now },
    },
    facts: [],
  };
}

let _config: StructuredMemoryConfig = DEFAULT_CONFIG;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingWrite: MemoryStore | null = null;

export function configureMemory(config: Partial<StructuredMemoryConfig>): void {
  _config = { ..._config, ...config };
}

export function getMemoryConfig(): StructuredMemoryConfig {
  return { ..._config };
}

function getUserMemoryPath(userId: string): string {
  return path.join(_config.storagePath, `${userId}.json`);
}

function getSystemMemoryPath(): string {
  return path.join(_config.storagePath, "system.json");
}

/**
 * Load memory for a user (or system default if no userId).
 */
export async function loadMemory(userId?: string): Promise<MemoryStore> {
  const filePath = userId ? getUserMemoryPath(userId) : getSystemMemoryPath();
  
  if (!existsSync(filePath)) {
    return createEmptyStore();
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as MemoryStore;
  } catch {
    return createEmptyStore();
  }
}

/**
 * Save memory for a user (debounced to avoid excessive writes).
 */
export async function saveMemory(store: MemoryStore, userId?: string): Promise<void> {
  _pendingWrite = store;
  
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
  }

  return new Promise((resolve) => {
    _debounceTimer = setTimeout(async () => {
      if (!_pendingWrite) {
        resolve();
        return;
      }
      
      const filePath = userId ? getUserMemoryPath(userId) : getSystemMemoryPath();
      const dir = path.dirname(filePath);
      
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      _pendingWrite.lastUpdated = new Date().toISOString();
      await writeFile(filePath, JSON.stringify(_pendingWrite, null, 2), "utf-8");
      _pendingWrite = null;
      resolve();
    }, _config.debounceMs);
  });
}

/**
 * Update a specific section of memory.
 */
export async function updateMemorySection(
  userId: string | undefined,
  section: keyof MemoryStore["user"] | keyof MemoryStore["history"],
  summary: string,
): Promise<void> {
  const store = await loadMemory(userId);
  
  if (section in store.user) {
    store.user[section as keyof MemoryStore["user"]].summary = summary;
    store.user[section as keyof MemoryStore["user"]].updatedAt = new Date().toISOString();
  } else if (section in store.history) {
    store.history[section as keyof MemoryStore["history"]].summary = summary;
    store.history[section as keyof MemoryStore["history"]].updatedAt = new Date().toISOString();
  }
  
  await saveMemory(store, userId);
}

/**
 * Add or update a fact.
 */
export async function upsertFact(
  userId: string | undefined,
  content: string,
  confidence: number,
  tags?: string[],
): Promise<void> {
  if (confidence < _config.factConfidenceThreshold) return;

  const store = await loadMemory(userId);
  
  // Check if fact already exists (by content match)
  const existing = store.facts.find((f) => f.content === content);
  
  if (existing) {
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.updatedAt = new Date().toISOString();
    if (tags) existing.tags = [...new Set([...(existing.tags ?? []), ...tags])];
  } else {
    const fact: Fact = {
      id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      confidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags,
    };
    store.facts.push(fact);
    
    // Trim to maxFacts
    if (store.facts.length > _config.maxFacts) {
      store.facts = store.facts
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, _config.maxFacts);
    }
  }
  
  await saveMemory(store, userId);
}

/**
 * Remove a fact by ID.
 */
export async function removeFact(userId: string | undefined, factId: string): Promise<void> {
  const store = await loadMemory(userId);
  store.facts = store.facts.filter((f) => f.id !== factId);
  await saveMemory(store, userId);
}

/**
 * Build memory injection text for system prompt.
 * Respects maxInjectionTokens budget.
 */
export async function buildMemoryInjection(userId?: string): Promise<string> {
  const store = await loadMemory(userId);
  const lines: string[] = [];
  
  // Helper to estimate tokens (rough: 4 chars per token)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  const budget = _config.maxInjectionTokens;
  let used = 0;

  const addLine = (text: string, tokens?: number) => {
    const t = tokens ?? estimateTokens(text);
    if (used + t > budget) return false;
    lines.push(text);
    used += t;
    return true;
  };

  addLine("\n[Memory]");
  
  // Top of mind (highest priority)
  if (store.user.topOfMind.summary) {
    addLine(`Top of mind: ${store.user.topOfMind.summary}`);
  }
  
  // Work context
  if (store.user.workContext.summary) {
    addLine(`Work context: ${store.user.workContext.summary}`);
  }
  
  // High-confidence facts
  const highConfidenceFacts = store.facts
    .filter((f) => f.confidence >= 0.8)
    .sort((a, b) => b.confidence - a.confidence);
  
  for (const fact of highConfidenceFacts) {
    if (!addLine(`Fact: ${fact.content}`)) break;
  }
  
  // Recent history
  if (store.history.recentMonths.summary) {
    addLine(`Recent: ${store.history.recentMonths.summary}`);
  }
  
  if (lines.length > 1) {
    addLine("[/Memory]");
    return lines.join("\n");
  }
  
  return "";
}

/**
 * Get all facts for a user, optionally filtered by tag or confidence.
 */
export async function getFacts(
  userId?: string,
  options?: { minConfidence?: number; tag?: string },
): Promise<Fact[]> {
  const store = await loadMemory(userId);
  
  return store.facts.filter((f) => {
    if (options?.minConfidence !== undefined && f.confidence < options.minConfidence) {
      return false;
    }
    if (options?.tag && !f.tags?.includes(options.tag)) {
      return false;
    }
    return true;
  });
}

export default {
  configureMemory,
  getMemoryConfig,
  loadMemory,
  saveMemory,
  updateMemorySection,
  upsertFact,
  removeFact,
  buildMemoryInjection,
  getFacts,
};
