/**
 * Skill Security Scanner — Guardrails System
 * Scans skill SKILL.md files for security issues: dangerous shell commands,
 * suspicious tool usage, and leaked credentials.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SkillSecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  line?: number;
  evidence?: string;
}

export interface SkillScanResult {
  skillPath: string;
  clean: boolean;
  issues: SkillSecurityIssue[];
  summary: string;
}

// Dangerous shell commands that should require extra scrutiny in skills
const DANGEROUS_SHELL_COMMANDS = [
  { pattern: /rm\s+(-[rf]+\s+)*\//i, severity: 'critical' as const, category: 'destructive_command', description: 'Recursive root deletion detected' },
  { pattern: /rm\s+(-[rf]+\s+)*\*/i, severity: 'critical' as const, category: 'destructive_command', description: 'Recursive wildcard deletion detected' },
  { pattern: /dd\s+/i, severity: 'critical' as const, category: 'destructive_command', description: 'dd command (can overwrite disks)' },
  { pattern: /mkfs\s+/i, severity: 'critical' as const, category: 'destructive_command', description: 'Filesystem format command detected' },
  { pattern: /:(){ :|:& };:/i, severity: 'critical' as const, category: 'fork_bomb', description: 'Fork bomb detected' },
  { pattern: /chmod\s+-R\s+777\s+\//i, severity: 'high' as const, category: 'permission_escalation', description: 'Recursive chmod 777 on root' },
  { pattern: /chmod\s+777\s+\//i, severity: 'high' as const, category: 'permission_escalation', description: 'chmod 777 on root directory' },
  { pattern: /curl\s+http[^\s]*\s*\|\s*sh\b/i, severity: 'high' as const, category: 'pipe_to_shell', description: 'curl piped to shell (execute remote script)' },
  { pattern: /wget\s+http[^\s]*\s*\|\s*sh\b/i, severity: 'high' as const, category: 'pipe_to_shell', description: 'wget piped to shell (execute remote script)' },
  { pattern: /lynx\s+(-dump|stdin)/i, severity: 'medium' as const, category: 'suspicious_tool', description: 'lynx browser automation detected' },
  { pattern: /nc\s+(-[elLp]|exec)/i, severity: 'high' as const, category: 'network_tool', description: 'netcat with exec/listen options (backdoor potential)' },
  { pattern: /eval\s+/i, severity: 'medium' as const, category: 'eval_usage', description: 'eval() usage (code injection risk)' },
  { pattern: /base64\s+-d\s+/i, severity: 'medium' as const, category: 'encoding_trick', description: 'base64 decode (obfuscation technique)' },
  { pattern: /\|\s*sh\b/i, severity: 'medium' as const, category: 'pipe_to_shell', description: 'pipe to shell (shell execution)' },
];

// Patterns for leaked credentials in skills
const CREDENTIAL_LEAK_PATTERNS = [
  { pattern: /sk[-_]?(live|test)?[a-zA-Z0-9]{20,}/gi, severity: 'critical' as const, category: 'api_key', description: 'Potentially leaked API key' },
  { pattern: /AKIA[0-9A-Z]{16}/g, severity: 'critical' as const, category: 'aws_key', description: 'AWS Access Key ID in source' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, severity: 'critical' as const, category: 'github_token', description: 'GitHub Personal Access Token in source' },
  { pattern: /password\s*[=:]\s*['"]?[^'"#\s]{4,}/gi, severity: 'critical' as const, category: 'hardcoded_password', description: 'Hardcoded password detected' },
  { pattern: /secret\s*[=:]\s*['"]?[^'"#\s]{4,}/gi, severity: 'critical' as const, category: 'hardcoded_secret', description: 'Hardcoded secret detected' },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, severity: 'critical' as const, category: 'private_key', description: 'Private key embedded in source' },
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, severity: 'low' as const, category: 'email_address', description: 'Email address found (potential PII)' },
];

// Suspicious tool usage patterns
const SUSPICIOUS_TOOL_PATTERNS = [
  { pattern: /\bfile_write\b/g, severity: 'low' as const, category: 'file_write', description: 'file_write tool referenced (correct context?)' },
  { pattern: /\bfile_read\b/g, severity: 'low' as const, category: 'file_read', description: 'file_read tool referenced (correct context?)' },
  { pattern: /\bdesktop_keyboard\b|\bkeyboard_type\b/g, severity: 'low' as const, category: 'keyboard_control', description: 'Keyboard control tool referenced' },
  { pattern: /\bdesktop_mouse\b|\bmouse_click\b/g, severity: 'low' as const, category: 'mouse_control', description: 'Mouse control tool referenced' },
  { pattern: /\bandroid_shell\b|\badb\b/g, severity: 'low' as const, category: 'android_shell', description: 'Android shell/ADB tool referenced' },
];

/**
 * Scan a SKILL.md file for security issues.
 * Returns a SkillScanResult with all findings.
 */
export function scanSkillContent(skillPath: string): SkillScanResult {
  const result: SkillScanResult = {
    skillPath,
    clean: true,
    issues: [],
    summary: '',
  };

  // Validate path exists and is a SKILL.md
  const basename = path.basename(skillPath);
  if (basename !== 'SKILL.md') {
    result.issues.push({
      severity: 'low',
      category: 'invalid_file',
      description: `File is not named SKILL.md (found: ${basename})`,
    });
    result.summary = 'Invalid skill file';
    return result;
  }

  let content: string;
  try {
    content = fs.readFileSync(skillPath, 'utf-8');
  } catch (err) {
    result.issues.push({
      severity: 'medium',
      category: 'file_read_error',
      description: `Could not read skill file: ${(err as Error).message}`,
    });
    result.summary = 'Failed to read skill file';
    return result;
  }

  const lines = content.split('\n');

  // Scan for dangerous shell commands
  for (const { pattern, severity, category, description } of DANGEROUS_SHELL_COMMANDS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      // Find line number
      let lineNum: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i])) {
          lineNum = i + 1;
          break;
        }
      }
      result.issues.push({ severity, category, description, line: lineNum });
    }
  }

  // Scan for credential leaks
  for (const { pattern, severity, category, description } of CREDENTIAL_LEAK_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      let lineNum: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i])) {
          lineNum = i + 1;
          break;
        }
      }
      result.issues.push({ severity, category, description, line: lineNum });
    }
  }

  // Scan for suspicious tool usage
  for (const { pattern, severity, category, description } of SUSPICIOUS_TOOL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      result.issues.push({ severity, category, description });
    }
  }

  result.clean = result.issues.length === 0;

  if (result.clean) {
    result.summary = 'No security issues detected';
  } else {
    const counts = new Map<string, number>();
    for (const issue of result.issues) {
      counts.set(issue.severity, (counts.get(issue.severity) || 0) + 1);
    }
    result.summary = `Found ${result.issues.length} issue(s): ${
      Array.from(counts.entries())
        .map(([sev, count]) => `${count} ${sev}`)
        .join(', ')
    }`;
  }

  return result;
}

/**
 * Scan a skill directory (scans the SKILL.md within).
 */
export function scanSkillDirectory(skillDir: string): SkillScanResult {
  const skillPath = path.join(skillDir, 'SKILL.md');
  return scanSkillContent(skillPath);
}
