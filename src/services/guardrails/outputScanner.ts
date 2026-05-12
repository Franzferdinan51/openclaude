/**
 * Output Scanner — Guardrails System
 * Scans agent output for sensitive data leaks such as API keys, tokens, passwords, and PII.
 */

export interface Finding {
  type: string;
  description: string;
  redacted: string;  // The redacted representation for logging
  startIndex: number;
  endIndex: number;
}

export interface ScanResult {
  clean: boolean;
  findings: Finding[];
  redacted?: string;  // Output with sensitive data masked (optional, opt-in)
}

/**
 * Patterns for sensitive data detection.
 */

// Generic API key patterns
const API_KEY_PATTERNS = [
  { pattern: /sk[-_]?(live|test)?[a-zA-Z0-9]{20,}/gi, type: 'api_key', description: 'Generic API key (sk_...)' },
  { pattern: /api[-_]?key[-_]?[a-zA-Z0-9]{16,}/gi, type: 'api_key', description: 'API key (api_key:...)' },
  { pattern: /[a-zA-Z0-9_-]{32,64}:[a-zA-Z0-9_-]{20,}/gi, type: 'api_key', description: 'Provider API key (key:secret)' },
];

// Cloud provider keys
const CLOUD_KEY_PATTERNS = [
  { pattern: /AKIA[0-9A-Z]{16}/g, type: 'aws_access_key', description: 'AWS Access Key ID' },
  { pattern: /aws_[a-zA-Z0-9_]{16,40}/gi, type: 'aws_secret', description: 'AWS Secret Access Key' },
  { pattern: /AIza[0-9A-Za-z_-]{35}/g, type: 'google_api_key', description: 'Google API Key' },
  { pattern: /ya29\.[0-9A-Za-z_-]{50,}/g, type: 'google_token', description: 'Google OAuth Token' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'github_token', description: 'GitHub Personal Access Token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, type: 'github_token', description: 'GitHub OAuth Token' },
  { pattern: /gsk_[a-zA-Z0-9]{52}/g, type: 'github_token', description: 'GitHub Server Access Token' },
  { pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/g, type: 'slack_token', description: 'Slack Token' },
  { pattern: /mongodb(\+srv)?:\/\/[^\s:'"]+:[^\s:'"]+@[^\s]+/gi, type: 'mongodb_uri', description: 'MongoDB URI with credentials' },
  { pattern: /postgres(ql)?:\/\/[^\s:'"]+:[^\s:'"]+@[^\s]+/gi, type: 'postgres_uri', description: 'PostgreSQL URI with credentials' },
  { pattern: /mysql:\/\/[^\s:'"]+:[^\s:'"]+@[^\s]+/gi, type: 'mysql_uri', description: 'MySQL URI with credentials' },
  { pattern: /redis:\/\/[^\s:'"]+:[^\s:'"]+@[^\s]+/gi, type: 'redis_uri', description: 'Redis URI with credentials' },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, type: 'private_key', description: 'Private key block' },
  { pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g, type: 'ssh_key', description: 'SSH private key' },
];

// Password/secret patterns
const SECRET_PATTERNS = [
  { pattern: /password\s*[=:]\s*['"]?[^'"#\s]{4,}/gi, type: 'password_literal', description: 'Hardcoded password' },
  { pattern: /passwd\s*[=:]\s*['"]?[^'"#\s]{4,}/gi, type: 'password_literal', description: 'Hardcoded passwd' },
  { pattern: /secret\s*[=:]\s*['"]?[^'"#\s]{4,}/gi, type: 'secret_literal', description: 'Hardcoded secret' },
  { pattern: /token\s*[=:]\s*['"]?[a-zA-Z0-9_-]{10,}/gi, type: 'token_literal', description: 'Hardcoded token' },
  { pattern: /bearer\s+[a-zA-Z0-9_-]{20,}/gi, type: 'bearer_token', description: 'Bearer token in Authorization header' },
  { pattern: /basic\s+[a-zA-Z0-9+=]{20,}/gi, type: 'basic_auth', description: 'Basic auth credentials (base64)' },
];

// PII patterns
const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'ssn', description: 'US Social Security Number' },
  { pattern: /\b\d{9}\b/, type: 'numeric_id', description: '9-digit numeric ID (potential SSN)' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email', description: 'Email address' },
  { pattern: /\b\d{10,11}\b/, type: 'phone', description: '10-11 digit phone number' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'phone', description: 'US phone number' },
  { pattern: /\b\d{16}\b/, type: 'credit_card', description: '16-digit credit card number' },
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, type: 'credit_card', description: 'Formatted credit card' },
];

// All patterns combined
const ALL_SENSITIVE_PATTERNS = [
  ...API_KEY_PATTERNS,
  ...CLOUD_KEY_PATTERNS,
  ...SECRET_PATTERNS,
  ...PII_PATTERNS,
];

/**
 * Scan output for sensitive data.
 * Returns all findings but does NOT automatically redact — use scanAndRedact for that.
 */
export function scanOutput(content: string): ScanResult {
  if (!content || typeof content !== 'string') {
    return { clean: true, findings: [] };
  }

  const findings: Finding[] = [];

  for (const { pattern, type, description } of ALL_SENSITIVE_PATTERNS) {
    // Reset lastIndex because regex with global flag is stateful
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      findings.push({
        type,
        description,
        redacted: maskMatch(match[0], type),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }
  }

  // Sort findings by position
  findings.sort((a, b) => a.startIndex - b.startIndex);

  return {
    clean: findings.length === 0,
    findings,
  };
}

/**
 * Mask a matched string for safe logging/display.
 */
function maskMatch(match: string, type: string): string {
  switch (type) {
    case 'api_key':
    case 'github_token':
    case 'slack_token':
    case 'aws_access_key':
    case 'google_api_key':
    case 'token_literal':
    case 'bearer_token':
    case 'basic_auth':
      // Show first 4 chars, mask rest
      if (match.length <= 4) {
        return '*'.repeat(match.length);
      }
      return match.substring(0, 4) + '*'.repeat(Math.min(match.length - 4, 20));
    
    case 'password_literal':
    case 'secret_literal':
      // Mask entirely for credentials
      return '[REDACTED]';
    
    case 'email':
      // Partially mask email: user@domain -> u***@d***
      const [user, domain] = match.split('@');
      if (user && domain) {
        const maskedUser = user.length > 1 ? user[0] + '*'.repeat(user.length - 1) : '*';
        const maskedDomain = domain.length > 1 ? domain[0] + '*'.repeat(domain.length - 1) : '*';
        return `${maskedUser}@${maskedDomain}`;
      }
      return '*'.repeat(match.length);
    
    case 'phone':
      // Show last 4 digits
      const digits = match.replace(/\D/g, '');
      return '*'.repeat(Math.max(digits.length - 4, 0)) + digits.slice(-4);
    
    case 'credit_card':
      // Show last 4
      const ccDigits = match.replace(/\D/g, '');
      return '*'.repeat(Math.max(ccDigits.length - 4, 0)) + ccDigits.slice(-4);
    
    case 'ssn':
      // Show last 4: ***-**-1234
      const ssnDigits = match.replace(/\D/g, '');
      return `***-**-${ssnDigits.slice(-4)}`;
    
    default:
      // Generic mask: show first and last char
      if (match.length <= 2) {
        return '*'.repeat(match.length);
      }
      return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
  }
}

/**
 * Scan and produce a redacted version of the content.
 * Only redacts if findings exist.
 */
export function scanAndRedact(content: string): ScanResult {
  const result = scanOutput(content);
  if (result.clean) {
    return result;
  }

  // Build redacted string by replacing each finding with its masked form
  // Process in reverse order to preserve indices
  let redacted = content;
  const reversed = [...result.findings].reverse();
  for (const finding of reversed) {
    const before = redacted.substring(0, finding.startIndex);
    const after = redacted.substring(finding.endIndex);
    redacted = before + finding.redacted + after;
  }

  result.redacted = redacted;
  return result;
}
