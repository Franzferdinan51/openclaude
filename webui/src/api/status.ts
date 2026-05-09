/**
 * System Status API
 * CPU, RAM, Disk usage from the local machine
 */

export interface SystemStatus {
  cpu: number;         // percent usage
  memory: number;     // percent used
  memoryUsed: number; // GB used
  memoryTotal: number;// GB total
  disk: number;        // percent used
  diskUsed: number;   // GB used
  diskTotal: number;  // GB total
  uptime: number;      // seconds
  platform: string;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const res = await fetch('http://localhost:18789/api/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    // Fallback: parse `top` / `df` output via a local endpoint
    return getLocalStatus();
  }
}

async function getLocalStatus(): Promise<SystemStatus> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const isMac = process.platform === 'darwin';

    let cpu = 0, memUsed = 0, memTotal = 8, diskUsed = 0, diskTotal = 100;
    try {
      if (isMac) {
        const memInfo = (await execAsync('sysctl hw.memsize')).stdout.trim();
        memTotal = parseInt(memInfo.split(':')[1]) / 1024 / 1024 / 1024;
        const vm = (await execAsync('vm_stat')).stdout;
        const pagesFree = parseInt((vm.match(/Pages free:\s+(\d+)/) || ['', '0'])[1]);
        const pagesActive = parseInt((vm.match(/Pages active:\s+(\d+)/) || ['', '0'])[1]);
        const pagesInactive = parseInt((vm.match(/Pages inactive:\s+(\d+)/) || ['', '0'])[1]);
        const pageSize = 4096;
        memUsed = (pagesActive + pagesInactive) * pageSize / 1024 / 1024 / 1024;
      }

      const df = (await execAsync('df -k /')).stdout;
      const parts = df.trim().split(/\s+/);
      diskTotal = parseInt(parts[1]) / 1024 / 1024;
      diskUsed = parseInt(parts[2]) / 1024 / 1024;
    } catch { /* ignore */ }

    return {
      cpu,
      memory: Math.round((memUsed / memTotal) * 100),
      memoryUsed: parseFloat(memUsed.toFixed(1)),
      memoryTotal: parseFloat(memTotal.toFixed(1)),
      disk: Math.round((diskUsed / diskTotal) * 100),
      diskUsed: parseFloat(diskUsed.toFixed(1)),
      diskTotal: parseFloat(diskTotal.toFixed(1)),
      uptime: 0,
      platform: process.platform,
    };
  } catch {
    return {
      cpu: 0, memory: 0, memoryUsed: 0, memoryTotal: 8,
      disk: 0, diskUsed: 0, diskTotal: 100,
      uptime: 0, platform: process.platform,
    };
  }
}