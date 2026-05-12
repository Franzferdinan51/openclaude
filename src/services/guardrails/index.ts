/**
 * Guardrails System — Unified Entry Point
 * Combines input validation, output scanning, and prompt injection detection
 * into a single Guardrails interface.
 */

export {
  type RiskLevel,
  type SanitizedInput,
  sanitizeUserInput,
} from './inputValidator';

export {
  type Finding,
  type ScanResult,
  scanOutput,
  scanAndRedact,
} from './outputScanner';

export {
  type InjectionResult,
  detectInjection,
  sanitizeInjection,
} from './promptInjectionDetector';

export {
  type SkillScanResult,
  scanSkillContent,
} from './skillSecurityScanner';

/**
 * Guardrails configuration.
 */
export interface GuardrailsConfig {
  /** Whether to automatically redact sensitive data in output (default: false) */
  autoRedact?: boolean;
  /** Whether to block high-risk inputs (default: false, advisory only) */
  blockHighRisk?: boolean;
  /** Whether to log all guardrails events (default: true) */
  logEvents?: boolean;
}

/**
 * Result from a full input scan.
 */
export interface GuardrailsResult {
  // From inputValidator
  input: {
    cleaned: string;
    riskLevel: 'low' | 'medium' | 'high';
    flags: string[];
  };
  // From promptInjectionDetector
  injection: {
    isInjection: boolean;
    confidence: number;
    type?: string;
    details?: string;
  };
}

/**
 * Result from an output scan.
 */
export interface OutputScanResult {
  clean: boolean;
  findings: Array<{
    type: string;
    description: string;
    redacted: string;
    startIndex: number;
    endIndex: number;
  }>;
  redacted?: string;  // Only present if autoRedact is enabled
}

/**
 * Guardrails — unified security interface.
 * Provides a single entry point for all guardrails operations.
 */
export class Guardrails {
  private config: GuardrailsConfig;

  constructor(config: GuardrailsConfig = {}) {
    this.config = {
      autoRedact: false,
      blockHighRisk: false,
      logEvents: true,
      ...config,
    };
  }

  /**
   * Full scan of user input: validates, sanitizes, and checks for injection.
   * Returns combined GuardrailsResult.
   */
  scan(input: string): GuardrailsResult {
    const { sanitizeUserInput } = require('./inputValidator');
    const { detectInjection } = require('./promptInjectionDetector');

    const sanitized = sanitizeUserInput(input);
    const injection = detectInjection(input);

    if (this.config.logEvents) {
      if (sanitized.riskLevel !== 'low' || injection.isInjection) {
        console.debug('[Guardrails] Input scan:', {
          riskLevel: sanitized.riskLevel,
          flags: sanitized.flags,
          injection: injection.isInjection,
          confidence: injection.confidence,
        });
      }
    }

    return {
      input: {
        cleaned: sanitized.cleaned,
        riskLevel: sanitized.riskLevel,
        flags: sanitized.flags,
      },
      injection: {
        isInjection: injection.isInjection,
        confidence: injection.confidence,
        type: injection.type,
        details: injection.details,
      },
    };
  }

  /**
   * Scan agent output for sensitive data.
   * Returns OutputScanResult with optional redaction.
   */
  scanOutput(output: string): OutputScanResult {
    const { scanAndRedact, scanOutput } = require('./outputScanner');

    const scanFn = this.config.autoRedact ? scanAndRedact : scanOutput;
    const result = scanFn(output);

    if (this.config.logEvents && !result.clean) {
      console.debug('[Guardrails] Output scan found sensitive data:', {
        count: result.findings.length,
        types: result.findings.map(f => f.type),
      });
    }

    return result;
  }

  /**
   * Convenience: sanitize input only (alias for inputValidator).
   * Returns just the SanitizedInput portion.
   */
  validateAndSanitize(input: string): {
    cleaned: string;
    riskLevel: 'low' | 'medium' | 'high';
    flags: string[];
  } {
    const { sanitizeUserInput } = require('./inputValidator');
    return sanitizeUserInput(input);
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<GuardrailsConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Default singleton instance (advisory mode, no auto-redact)
let defaultInstance: Guardrails | null = null;

export function getDefaultGuardrails(): Guardrails {
  if (!defaultInstance) {
    defaultInstance = new Guardrails();
  }
  return defaultInstance;
}
