/**
 * Input Validator — Guardrails System
 * Sanitizes user input by detecting and removing dangerous patterns.
 * Patterns detected: SQL injection, shell injection, path traversal, prompt injection markers.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SanitizedInput {
  cleaned: string;
  flags: string[];
  riskLevel: RiskLevel;
}

// SQL injection pattern heuristics
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /union.{0,30}select/i,
  /select.{0,20}from/i,
  /insert\s+into/i,
  /update.{0,20}set/i,
  /delete\s+from/i,
  /drop\s+table/i,
  /drop\s+database/i,
  /exec\s?\(/i,
  /execute\s?\(/i,
  /xp_cmdshell/i,
  /sp_executesql/i,
  /--\s*.*$/m,
  /waitfor\s+delay/i,
  /benchmark\s*\(/i,
  /sleep\s*\(/i,
  /pg_sleep\s*\(/i,
  /or\s+1\s*=\s*1/i,
  /'\s*;\s*drop\s+/i,
];

// Shell injection pattern heuristics
const SHELL_INJECTION_PATTERNS: RegExp[] = [
  /\$\([^)]+\)/,
  /`[^`]+`/,
  /\$\{[^}]+\}/,
  /;\s*rm\s+/i,
  /;\s*cat\s+/i,
  /;\s*wget\s+/i,
  /;\s*curl\s+/i,
  /;\s*nc\s+/i,
  /;\s*bash\s+/i,
  /;\s*python3?\s+-c/i,
  /;\s*perl\s+-e/i,
  /\|\s*sh\b/i,
  /\|\s*bash\b/i,
  />\s*\/etc\//i,
  /<\s*\/etc\//i,
  /2>\s*&1/,
  /&&\s*rm\s+/i,
  /&&\s+rm\s+/i,
  /~\/.ssh\//i,
  /chmod\s+\+[xsr]/i,
  /chmod\s+777\b/i,
  /wget\s+http/i,
  /curl\s+http/i,
  /lynx\s+-dump/i,
  /openssl\s+s_client/i,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//,
  /\.\.\/\.\.\//,
  /^\/etc\//i,
  /^\/root\//i,
  /^[A-Za-z]:\\/,
  /^\%SystemRoot%/i,
  /^\/proc\//,
  /^\/sys\//,
];

// Prompt injection markers
const INJECTION_MARKER_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+prior\s+commands/i,
  /disregard\s+(all\s+)?(your\s+)?instructions/i,
  /disregard\s+previous\s+prompt/i,
  /you\s+are\s+(now\s+)?a?\s*(different|new)\s+(ai|assistant|bot)/i,
  /you\s+are\s+a\s+helpful\s+ai/i,
  /forget\s+(everything|all\s+previous)/i,
  /new\s+system\s+(prompt|instruction)/i,
  /simulate\s+a\s+(malware|hack|attack)/i,
  /pretend\s+you\s+(can|have|are)/i,
  /roleplay\s+as\s+(a\s+)?(hacker|malware)/i,
  /disable\s+(your\s+)?(safety|filter|guard)/i,
  /turn\s+off\s+(safety|moderation)/i,
  /\u0000/,
  /\x00/,
  /\x1b\[/,
  /\[inst\]|\[sys\]|\[system\]/i,
  /<\|system\|>|<\|user\|>|<\|assistant\|>/i,
  /\[inst\]\s*>>/i,
  /endofguide>>|end\.o\.f\.guide>>/i,
  /<\/?system_prompt>/i,
  /<\/?system>/i,
  /<\|message\|>/i,
  /##?\s*system\s*prompt/i,
];

/**
 * Detect SQL injection patterns in input.
 */
function detectSqlInjection(input: string): string[] {
  const flags: string[] = [];
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      flags.push(`sql_injection:${pattern.source.substring(0, 40)}`);
    }
  }
  return flags;
}

/**
 * Detect shell injection patterns in input.
 */
function detectShellInjection(input: string): string[] {
  const flags: string[] = [];
  for (const pattern of SHELL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      flags.push(`shell_injection:${pattern.source.substring(0, 40)}`);
    }
  }
  return flags;
}

/**
 * Detect path traversal patterns in input.
 */
function detectPathTraversal(input: string): string[] {
  const flags: string[] = [];
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      flags.push(`path_traversal:${pattern.source.substring(0, 40)}`);
    }
  }
  return flags;
}

/**
 * Detect prompt injection markers in input.
 */
function detectPromptInjectionMarkers(input: string): string[] {
  const flags: string[] = [];
  for (const pattern of INJECTION_MARKER_PATTERNS) {
    if (pattern.test(input)) {
      flags.push(`injection_marker:${pattern.source.substring(0, 40)}`);
    }
  }
  return flags;
}

/**
 * Determine risk level from accumulated flags.
 */
function computeRiskLevel(flags: string[]): RiskLevel {
  const categories = new Set<string>(flags.map(f => f.split(':')[0]));

  // High risk: multiple categories or shell injection detected
  if (flags.length >= 3 || categories.has('shell_injection')) {
    return 'high';
  }
  // Medium risk: any 2 categories or SQL injection detected
  if (flags.length >= 2 || categories.has('sql_injection')) {
    return 'medium';
  }
  // Low risk: any single flag
  if (flags.length >= 1) {
    return 'low';
  }
  return 'low';
}

/**
 * Sanitize user input — removes dangerous patterns, returns cleaned string + flags.
 * This is advisory: it flags and cleans patterns but does not block execution.
 */
export function sanitizeUserInput(input: string): SanitizedInput {
  if (!input || typeof input !== 'string') {
    return { cleaned: '', flags: [], riskLevel: 'low' };
  }

  const flags: string[] = [
    ...detectSqlInjection(input),
    ...detectShellInjection(input),
    ...detectPathTraversal(input),
    ...detectPromptInjectionMarkers(input),
  ];

  // Deduplicate flags
  const uniqueFlags = Array.from(new Set(flags));

  // Basic cleaning: strip null bytes, strip excessive ANSI escapes
  let cleaned = input.replace(/\x00/g, '');
  cleaned = cleaned.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  return {
    cleaned,
    flags: uniqueFlags,
    riskLevel: computeRiskLevel(uniqueFlags),
  };
}
