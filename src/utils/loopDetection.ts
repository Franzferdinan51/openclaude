/**
 * Loop Detection Middleware
 * Detects repeated tool call sequences and prevents infinite loops.
 * Inspired by DeerFlow's LoopDetectionMiddleware.
 */

export interface LoopDetectionConfig {
  /** Maximum times a sequence can repeat before triggering a pause. Default: 3 */
  maxRepeatCount: number;
  /** Minimum sequence length to track. Default: 2 */
  minSequenceLength: number;
  /** Window size for tracking sequences (in calls). Default: 10 */
  windowSize: number;
  /** Callback when loop is detected. */
  onLoopDetected?: (info: LoopInfo) => void;
}

export interface LoopInfo {
  sequence: string[];
  repeatCount: number;
  totalCalls: number;
  lastSeenAt: number;
}

interface SequenceEntry {
  sequence: string[];
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  recentPositions: number[]; // positions in the call history
}

/**
 * Tracks tool call sequences and detects when loops occur.
 */
export class LoopDetector {
  private config: LoopDetectionConfig;
  private callHistory: string[] = [];
  private sequences: Map<string, SequenceEntry> = new Map();
  private callIndex = 0;

  constructor(config: Partial<LoopDetectionConfig> = {}) {
    this.config = {
      maxRepeatCount: config.maxRepeatCount ?? 3,
      minSequenceLength: config.minSequenceLength ?? 2,
      windowSize: config.windowSize ?? 10,
      onLoopDetected: config.onLoopDetected,
    };
  }

  /**
   * Record a tool call and check for loops.
   * Returns true if a loop was detected.
   */
  recordCall(toolName: string): LoopInfo | null {
    this.callHistory.push(toolName);
    this.callIndex++;

    // Keep window size bounded
    if (this.callHistory.length > this.config.windowSize) {
      this.callHistory.shift();
    }

    // Check for repeated sequences
    return this.checkForLoops();
  }

  /**
   * Record multiple tool calls at once.
   */
  recordCalls(toolNames: string[]): LoopInfo | null {
    let lastLoop: LoopInfo | null = null;
    for (const tool of toolNames) {
      const loop = this.recordCall(tool);
      if (loop) lastLoop = loop;
    }
    return lastLoop;
  }

  private checkForLoops(): LoopInfo | null {
    const history = this.callHistory;
    const minLen = this.config.minSequenceLength;

    // Build a map of all sequences of length 2 to windowSize
    for (let len = minLen; len <= Math.min(history.length, this.config.windowSize); len++) {
      for (let start = 0; start <= history.length - len; start++) {
        const seq = history.slice(start, start + len);
        const key = seq.join("→");

        const existing = this.sequences.get(key);
        if (existing) {
          existing.count++;
          existing.lastSeenAt = Date.now();
          existing.recentPositions.push(this.callIndex);
          if (existing.count >= this.config.maxRepeatCount) {
            const info: LoopInfo = {
              sequence: seq,
              repeatCount: existing.count,
              totalCalls: this.callIndex,
              lastSeenAt: existing.lastSeenAt,
            };
            this.config.onLoopDetected?.(info);
            return info;
          }
        } else {
          this.sequences.set(key, {
            sequence: seq,
            count: 1,
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
            recentPositions: [this.callIndex],
          });
        }
      }
    }
    return null;
  }

  /**
   * Check if a specific sequence pattern is repeating.
   */
  isRepeating(sequence: string[], minRepeats = 3): boolean {
    const key = sequence.join("→");
    const entry = this.sequences.get(key);
    return entry ? entry.count >= minRepeats : false;
  }

  /**
   * Get current call history.
   */
  getCallHistory(): string[] {
    return [...this.callHistory];
  }

  /**
   * Get all tracked sequences with their repeat counts.
   */
  getTrackedSequences(): Array<{ sequence: string[]; count: number }> {
    return Array.from(this.sequences.values())
      .filter((e) => e.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get the most repeated sequence.
   */
  getMostRepeatedSequence(): LoopInfo | null {
    let max: SequenceEntry | null = null;
    for (const entry of this.sequences.values()) {
      if (!max || entry.count > max.count) {
        max = entry;
      }
    }
    if (!max || max.count < 2) return null;
    return {
      sequence: max.sequence,
      repeatCount: max.count,
      totalCalls: this.callIndex,
      lastSeenAt: max.lastSeenAt,
    };
  }

  /**
   * Reset all tracking state.
   */
  reset(): void {
    this.callHistory = [];
    this.sequences.clear();
    this.callIndex = 0;
  }

  /**
   * Generate a human-readable warning message.
   */
  formatLoopWarning(info: LoopInfo): string {
    const seqStr = info.sequence.join(" → ");
    return [
      `⚠️ **Loop Detected**`,
      ``,
      `The sequence \`${seqStr}\` has repeated **${info.repeatCount}x**.`,
      ``,
      `This may indicate an infinite loop. Consider:`,
      `- Verifying the task goal is achievable`,
      `- Checking if file permissions are correct`,
      `- Using a different approach to solve the problem`,
    ].join("\n");
  }
}

/**
 * Create a default loop detector with console logging.
 */
export function createLoopDetector(
  config?: Partial<LoopDetectionConfig>,
): LoopDetector {
  return new LoopDetector({
    ...config,
    onLoopDetected: config?.onLoopDetected ?? ((info) => {
      console.warn(
        `[LoopDetection] Loop detected: ${info.sequence.join("→")} repeated ${info.repeatCount}x`,
      );
    }),
  });
}

/**
 * Common loop patterns to watch for.
 */
export const KNOWN_LOOP_PATTERNS = {
  FILE_READ_EDIT: ["read", "write", "read", "write"],
  SHELL_RETRY: ["bash", "bash", "bash"],
  SEARCH_REPEAT: ["search", "search", "search"],
  COMPILE_LOOP: ["write", "bash", "read", "write", "bash", "read"],
} as const;

/**
 * Check if current history matches a known loop pattern.
 */
export function matchesKnownLoopPattern(
  detector: LoopDetector,
  pattern: string[],
  minRepeats = 2,
): boolean {
  return detector.isRepeating(pattern, minRepeats);
}

export default LoopDetector;
