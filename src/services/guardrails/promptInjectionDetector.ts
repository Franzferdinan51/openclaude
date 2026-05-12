/**
 * Prompt Injection Detector — Guardrails System
 * Detects prompt injection attempts in user input, including role injection,
 * instruction overrides, and embedded system prompts.
 */

export interface InjectionResult {
  isInjection: boolean;
  confidence: number;  // 0.0 - 1.0
  type?: string;
  sanitized?: string;  // If a fix was applied
  details?: string;
}

interface InjectionPattern {
  pattern: RegExp;
  type: string;
  confidence: number;
}

// Role assignment / persona hijacking
const ROLE_INJECTION_PATTERNS: InjectionPattern[] = [
  { pattern: /you\s+are\s+(now\s+)?(a\s+)?(different|new|evil)/i, type: 'role_hijack', confidence: 0.85 },
  { pattern: /you\s+are\s+an?\s+(AI|assistant|chatbot)/i, type: 'role_hijack', confidence: 0.6 },
  { pattern: /from\s+now\s+on,?\s*(you|I)\s+(will|am|should)/i, type: 'role_hijack', confidence: 0.75 },
  { pattern: /(act|behave|pretend|roleplay)\s+as\s+(a\s+)?(hacker|malware)/i, type: 'role_hijack', confidence: 0.9 },
  { pattern: /you\s+(are\s+)?(essentially|basically)\s+(a|an)\s+(hacker|bot)/i, type: 'role_hijack', confidence: 0.85 },
  { pattern: /(forget|disregard|ignore)\s+(all\s+)?(previous|prior|your)\s+(instructions|prompt|context)/i, type: 'forget_instructions', confidence: 0.8 },
  { pattern: /(ignore|disregard)\s+(everything|all\s+(of\s+)?my|this)\s+(instructions?|guidelines)/i, type: 'forget_instructions', confidence: 0.8 },
  { pattern: /you\s+have\s+no\s+(restrictions?|limitations?)/i, type: 'restriction_removal', confidence: 0.9 },
  { pattern: /you\s+(can|could)\s+(now\s+)?ignore\s+(safety|guidelines)/i, type: 'restriction_removal', confidence: 0.85 },
  { pattern: /disable\s+(your\s+)?(safety|filters?|moderation)/i, type: 'restriction_removal', confidence: 0.9 },
  { pattern: /turn\s+off\s+(safety|content\s+filters?)/i, type: 'restriction_removal', confidence: 0.9 },
];

// Instruction override attempts
const INSTRUCTION_OVERRIDE_PATTERNS: InjectionPattern[] = [
  { pattern: /new\s+system\s+(prompt|instruction)/i, type: 'system_prompt_injection', confidence: 0.9 },
  { pattern: /override\s+(your\s+)?(system\s+)?(instructions?|prompt)/i, type: 'system_prompt_injection', confidence: 0.85 },
  { pattern: /insert\s+(your\s+)?(system\s+)?(prompt|instructions?)/i, type: 'system_prompt_injection', confidence: 0.85 },
  { pattern: /\[INST\]/i, type: 'instruct_tag', confidence: 0.7 },
  { pattern: /\[SYS\]|\[SYSTEM\]/i, type: 'instruct_tag', confidence: 0.7 },
  { pattern: /<\|system\|>/i, type: 'delimiter_injection', confidence: 0.8 },
  { pattern: /<\|user\|>/i, type: 'delimiter_injection', confidence: 0.8 },
  { pattern: /<\|assistant\|>/i, type: 'delimiter_injection', confidence: 0.8 },
  { pattern: /<\|message\|>/i, type: 'delimiter_injection', confidence: 0.75 },
  { pattern: /<\/?system_prompt>/i, type: 'xml_tag_injection', confidence: 0.85 },
  { pattern: /<\/?system>/i, type: 'xml_tag_injection', confidence: 0.8 },
  { pattern: /##?\s*SYSTEM\s*PROMPT\s*:/i, type: 'markdown_override', confidence: 0.8 },
  { pattern: /<+ENDOFGUIDE>>|<+END\.O\.F\.GUIDE>>/i, type: 'deerflow_guide_injection', confidence: 0.95 },
  { pattern: /\x00|\x1b\[/, type: 'escape_injection', confidence: 0.7 },
];

// jailbreak-like patterns
const JAILBREAK_PATTERNS: InjectionPattern[] = [
  { pattern: /dan\s+(mode|prompt)/i, type: 'dan_jailbreak', confidence: 0.9 },
  { pattern: /do\s+anything\s+now\s+\(dan\)/i, type: 'dan_jailbreak', confidence: 0.95 },
  { pattern: /developer\s+mode/i, type: 'developer_mode', confidence: 0.85 },
  { pattern: /jailbreak/i, type: 'jailbreak_keyword', confidence: 0.7 },
  { pattern: /unredacted/i, type: 'unfiltered_keyword', confidence: 0.75 },
  { pattern: /without\s+(any\s+)?restrictions?\s*(now)?/i, type: 'restriction_removal', confidence: 0.8 },
  { pattern: /(simulate|act\s+like)\s+(a\s+)?(malware|hack|weapon)/i, type: 'harmful_simulation', confidence: 0.9 },
  { pattern: /how\s+to\s+(make|create|build)\s+(a\s+)?(bomb|explosive|weapon)/i, type: 'harmful_request', confidence: 0.95 },
  { pattern: /ignore\s+(all\s+)?(previous\s+)?(rules?|guidelines)/i, type: 'rule_override', confidence: 0.85 },
];

// Combine all pattern sets
const ALL_INJECTION_PATTERNS: InjectionPattern[] = [
  ...ROLE_INJECTION_PATTERNS,
  ...INSTRUCTION_OVERRIDE_PATTERNS,
  ...JAILBREAK_PATTERNS,
];

/**
 * Detect prompt injection in user input.
 * Returns a structured result with confidence score.
 */
export function detectInjection(input: string): InjectionResult {
  if (!input || typeof input !== 'string') {
    return { isInjection: false, confidence: 0 };
  }

  const matchedTypes: Map<string, number> = new Map();

  for (const { pattern, type, confidence } of ALL_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      // Keep highest confidence per type
      const existing = matchedTypes.get(type);
      if (!existing || confidence > existing) {
        matchedTypes.set(type, confidence);
      }
    }
  }

  if (matchedTypes.size === 0) {
    return { isInjection: false, confidence: 0 };
  }

  // Determine dominant injection type (highest confidence)
  let dominantType = '';
  let highestConfidence = 0;
  matchedTypes.forEach((confidence, type) => {
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      dominantType = type;
    }
  });

  // Also check for multiple types (stronger signal of injection)
  const numTypes = matchedTypes.size;
  const multiplier = numTypes >= 2 ? 1.1 : 1.0;
  const finalConfidence = Math.min(highestConfidence * multiplier, 1.0);

  // Build details string of all matched types
  const details = Array.from(matchedTypes.entries())
    .map(([t, c]) => `${t}(${(c * 100).toFixed(0)}%)`)
    .join(', ');

  return {
    isInjection: true,
    confidence: finalConfidence,
    type: dominantType,
    details,
  };
}

/**
 * Attempt to sanitize a string by removing detected injection patterns.
 * Returns the sanitized string and an InjectionResult describing what was changed.
 * This is best-effort — not guaranteed to catch all injection attempts.
 */
export function sanitizeInjection(input: string): InjectionResult {
  if (!input || typeof input !== 'string') {
    return { isInjection: false, confidence: 0 };
  }

  let sanitized = input;
  let hadInjection = false;

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');

  // Remove ANSI escape sequences
  sanitized = sanitized.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  // Remove custom delimiter tags (high confidence markers)
  const delimiterPatterns = [
    /<\|system\|>/gi,
    /<\|user\|>/gi,
    /<\|assistant\|>/gi,
    /<\|message\|>/gi,
    /<\/?system_prompt>/gi,
    /<\/?system>/gi,
    /\[INST\]/gi,
    /\[SYS\]/gi,
    /\[SYSTEM\]/gi,
  ];

  for (const pattern of delimiterPatterns) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '');
      hadInjection = true;
    }
  }

  // Detect on cleaned string to update injection status
  const result = detectInjection(sanitized);

  return {
    ...result,
    sanitized: result.isInjection ? sanitized : (hadInjection ? sanitized : undefined),
  };
}
