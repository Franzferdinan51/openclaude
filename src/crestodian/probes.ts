/**
 * DuckCustodian Probes — health checks for mmx, LM Studio, OpenClaw, Git, Node.
 */
import { spawn } from 'node:child_process';

export type LocalCommandProbe = {
  command: string;
  found: boolean;
  version?: string;
  error?: string;
};

export async function probeLocalCommand(
  command: string,
  args: string[] = ['--version'],
  opts: { timeoutMs?: number } = {},
): Promise<LocalCommandProbe> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  return await new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const finish = (result: LocalCommandProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ command, found: true, error: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (err: NodeJS.ErrnoException) => {
      finish({ command, found: err.code !== 'ENOENT', error: err.code === 'ENOENT' ? 'not found' : err.message });
    });
    child.on('close', (code) => {
      const text = `${stdout}\n${stderr}`.trim().split(/\r?\n/)[0]?.trim();
      finish({
        command,
        found: code === 0 || Boolean(text),
        version: text || undefined,
        error: code === 0 ? undefined : `exited ${String(code)}`,
      });
    });
  });
}

export async function probeGatewayUrl(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<{ reachable: boolean; url: string; error?: string }> {
  const httpUrl = url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
  const healthUrl = new URL('/health', httpUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const response = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return { reachable: response.ok, url, error: response.ok ? undefined : response.statusText };
  } catch (err) {
    clearTimeout(timeout);
    return { reachable: false, url, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function probeOpenClawGateway(
  port = 18789,
  opts = {},
): Promise<{ reachable: boolean; version?: string; error?: string }> {
  // Try localhost first, then common gateway ports
  const ports = [port, 18792, 18789];
  for (const p of ports) {
    const result = await probeGatewayUrl(`http://localhost:${p}`, opts);
    if (result.reachable) {
      // Try to get version
      try {
        const r = await fetch(`http://localhost:${p}/health`, { signal: AbortSignal.timeout(3000) });
        const json = await r.json().catch(() => ({}));
        return { reachable: true, version: json.version ?? json.tag ?? json.service ?? String(p), error: undefined };
      } catch {
        return { reachable: true, version: String(p), error: undefined };
      }
    }
  }
  return { reachable: false, error: 'OpenClaw gateway not reachable on common ports' };
}

export async function probeLmStudio(
  url = 'http://localhost:1234',
  opts: { timeoutMs?: number } = {},
): Promise<{ found: boolean; models: string[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
    const response = await fetch(`${url}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.LMSTUDIO_API_KEY ?? ''}` },
    });
    clearTimeout(timeout);
    if (!response.ok) return { found: false, models: [], error: `HTTP ${response.status}` };
    const json = await response.json().catch(() => ({}));
    const models: string[] = Array.isArray(json.data)
      ? json.data.map((m: { id?: string }) => m.id ?? 'unknown')
      : [];
    return { found: true, models, error: undefined };
  } catch (err) {
    return { found: false, models: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function probeMmx(): Promise<LocalCommandProbe> {
  return probeLocalCommand('mmx', ['--version'], { timeoutMs: 5000 });
}

export async function probeOpenClaw(): Promise<LocalCommandProbe> {
  // Try both 'openclaw' and 'oa' (Android alias) commands
  const r = await probeLocalCommand('openclaw', ['--version'], { timeoutMs: 5000 });
  if (r.found) return r;
  return probeLocalCommand('oa', ['--version'], { timeoutMs: 5000 });
}

export async function probeGit(): Promise<LocalCommandProbe> {
  return probeLocalCommand('git', ['--version'], { timeoutMs: 3000 });
}

export async function probeNode(): Promise<LocalCommandProbe> {
  return probeLocalCommand('node', ['--version'], { timeoutMs: 3000 });
}

export async function probeDuckHiveWorkspace(): Promise<{ path: string; exists: boolean; isGit: boolean }> {
  const cwd = process.cwd();
  return {
    path: cwd,
    exists: true,
    isGit: true, // Would need fs check for real implementation
  };
}
