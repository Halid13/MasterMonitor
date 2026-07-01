import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { captureSystemEvents } from '@/services/eventCapture';
import { persistMonitoringSnapshot } from '@/lib/monitoring-db';

const { MM_SSH_USER, MM_SSH_PASS } = process.env;

const isSafeHost = (value: string) => /^[a-zA-Z0-9._:-]+$/.test(value);

// ─── Linux : SSH + commandes shell ───────────────────────────────────────────

interface LinuxMetrics {
  ok: true;
  host: string;
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  memTotal: number;
  memFree: number;
  diskTotal: number;
  diskFree: number;
  stoppedServices: string[];
}

const runSshLinuxMetrics = (host: string): Promise<LinuxMetrics> =>
  new Promise((resolve, reject) => {
    const sshUser = (MM_SSH_USER || 'root').replace(/'/g, '');
    const sshPass = MM_SSH_PASS || '';

    const remoteCmd = [
      'hostname',
      "awk 'NR==1{printf \"%d\\n\",$1}' /proc/uptime",
      "awk '/^cpu /{t=0;for(i=2;i<=NF;i++)t+=$i; printf \"%.2f\\n\",(1-$5/t)*100}' /proc/stat",
      "awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{printf \"%d %d\\n\",t*1024,a*1024}' /proc/meminfo",
      "df -B1 / | awk 'NR==2{print $2, $4}'",
    ].join(' && ');

    const tryExec = (cmd: string, env: NodeJS.ProcessEnv, cb: (err: any, out: string) => void) => {
      exec(cmd, { timeout: 30_000, encoding: 'utf8', env }, (err, stdout, stderr) => {
        if (err) return cb({ err, stdout, stderr }, '');
        cb(null, stdout);
      });
    };

    const sshBaseOpts = `-o StrictHostKeyChecking=no -o ConnectTimeout=10`;
    // Base64-encode the command to avoid quoting conflicts with single quotes in awk
    const encoded = Buffer.from(remoteCmd).toString('base64');
    const target = `${sshUser}@${host}`;
    const remoteExec = `'echo ${encoded} | base64 -d | sh'`;

    if (sshPass) {
      // Tenter d'abord avec sshpass (si disponible)
      const sshPassCmd = `sshpass -e ssh ${sshBaseOpts} ${target} ${remoteExec}`;
      tryExec(sshPassCmd, { ...process.env, SSHPASS: sshPass }, (err, out) => {
        if (!err) return resolve(parseSshOutput(out, host));
        // Fallback : SSH standard (clé RSA si configurée)
        const sshCmd = `ssh ${sshBaseOpts} -o BatchMode=yes ${target} ${remoteExec}`;
        tryExec(sshCmd, process.env as NodeJS.ProcessEnv, (err2, out2) => {
          if (err2) return reject(err2);
          resolve(parseSshOutput(out2, host));
        });
      });
    } else {
      const sshCmd = `ssh ${sshBaseOpts} -o BatchMode=yes ${target} ${remoteExec}`;
      tryExec(sshCmd, process.env as NodeJS.ProcessEnv, (err, out) => {
        if (err) return reject(err);
        resolve(parseSshOutput(out, host));
      });
    }
  });

function parseSshOutput(stdout: string, host: string): LinuxMetrics {
  const lines = stdout.trim().split('\n').map((l) => l.trim());
  const hostname = lines[0] || host;
  const uptime = parseInt(lines[1] || '0', 10) || 0;
  const cpu = parseFloat(lines[2] || '0') || 0;
  const [memTotalBytes, memFreeBytes] = (lines[3] || '0 0').split(' ').map(Number);
  const [diskTotalBytes, diskFreeBytes] = (lines[4] || '0 0').split(' ').map(Number);
  const memory = memTotalBytes > 0 ? ((memTotalBytes - memFreeBytes) / memTotalBytes) * 100 : 0;
  const disk = diskTotalBytes > 0 ? ((diskTotalBytes - diskFreeBytes) / diskTotalBytes) * 100 : 0;
  return {
    ok: true,
    host: hostname,
    cpu: Math.round(cpu * 100) / 100,
    memory: Math.round(memory * 100) / 100,
    disk: Math.round(disk * 100) / 100,
    uptime,
    memTotal: memTotalBytes,
    memFree: memFreeBytes,
    diskTotal: diskTotalBytes,
    diskFree: diskFreeBytes,
    stoppedServices: [],
  };
}

// ─── Windows : SSH + PowerShell ──────────────────────────────────────────────

const runSshWindowsMetrics = (host: string): Promise<LinuxMetrics> =>
  new Promise((resolve, reject) => {
    const sshUser = (process.env.MM_WIN_SSH_USER || MM_SSH_USER || 'Administrator').replace(/'/g, '');
    const sshPass = process.env.MM_WIN_SSH_PASS || MM_SSH_PASS || '';

    // Script PowerShell encodé UTF-16LE (base64) pour éviter les problèmes de quotes via SSH
    const psScript = [
      '$cpu = [Math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average, 2)',
      '$os = Get-CimInstance Win32_OperatingSystem',
      "$disk = Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"",
      '$memTotal = $os.TotalVisibleMemorySize * 1024',
      '$memFree = $os.FreePhysicalMemory * 1024',
      '$uptime = [int](New-TimeSpan -Start $os.LastBootUpTime -End (Get-Date)).TotalSeconds',
      'Write-Output $env:COMPUTERNAME',
      'Write-Output $uptime',
      'Write-Output $cpu',
      'Write-Output "$memTotal $memFree"',
      'Write-Output "$($disk.Size) $($disk.FreeSpace)"',
    ].join('; ');

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const remoteCmd = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`;

    const tryExec = (cmd: string, env: NodeJS.ProcessEnv, cb: (err: any, out: string) => void) => {
      exec(cmd, { timeout: 30_000, encoding: 'utf8', env }, (err, stdout, stderr) => {
        if (err) return cb({ err, stdout, stderr }, '');
        cb(null, stdout);
      });
    };

    const sshBaseOpts = `-o StrictHostKeyChecking=no -o ConnectTimeout=10`;

    if (sshPass) {
      const sshPassCmd = `sshpass -e ssh ${sshBaseOpts} -l '${sshUser}' ${host} '${remoteCmd}'`;
      tryExec(sshPassCmd, { ...process.env, SSHPASS: sshPass }, (err, out) => {
        if (!err) return resolve(parseSshOutput(out, host));
        const sshCmd = `ssh ${sshBaseOpts} -o BatchMode=yes -l '${sshUser}' ${host} '${remoteCmd}'`;
        tryExec(sshCmd, process.env as NodeJS.ProcessEnv, (err2, out2) => {
          if (err2) return reject(err2);
          resolve(parseSshOutput(out2, host));
        });
      });
    } else {
      const sshCmd = `ssh ${sshBaseOpts} -o BatchMode=yes -l '${sshUser}' ${host} '${remoteCmd}'`;
      tryExec(sshCmd, process.env as NodeJS.ProcessEnv, (err, out) => {
        if (err) return reject(err);
        resolve(parseSshOutput(out, host));
      });
    }
  });

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = String(searchParams.get('host') || '').trim();
  const type = String(searchParams.get('type') || 'windows').toLowerCase();
  const debug = searchParams.get('debug') === '1';

  if (!host || !isSafeHost(host)) {
    return NextResponse.json({ ok: false, error: 'Hôte invalide.' }, { status: 400 });
  }

  // ── Chemin Linux (SSH) ──────────────────────────────────────────────────────
  if (type === 'linux') {
    try {
      const data = await runSshLinuxMetrics(host);

      const responsePayload = {
        ok: true,
        host: data.host,
        cpu: data.cpu,
        memory: data.memory,
        disk: data.disk,
        uptime: data.uptime,
        subnetMask: null,
        diskTotal: data.diskTotal,
        diskFree: data.diskFree,
        memTotal: data.memTotal,
        memFree: data.memFree,
        stoppedServices: [] as string[],
      };

      try {
        await persistMonitoringSnapshot({
          servers: [{
            id: `remote-${host}`, name: data.host, ipAddress: host, status: 'online',
            healthScore: Math.round(100 - Math.max(data.cpu, data.memory, data.disk)),
            metrics: { cpuUsage: data.cpu, memoryUsage: data.memory, diskUsage: data.disk, uptime: data.uptime, networkIn: 0, networkOut: 0, processCount: 0 },
            lastHealthCheck: new Date(), services: [],
          }],
        });
      } catch { /* DB failure non bloquante */ }

      return NextResponse.json(responsePayload);
    } catch (err: any) {
      const rootErr = err?.err || err;
      const message = rootErr?.message || err?.message || 'Unknown error';
      captureSystemEvents.connectivityIssue(host, host, 'SSH', message);
      return NextResponse.json(
        { ok: false, error: 'Erreur de récupération SSH.', details: debug ? { message, stderr: err?.stderr, stdout: err?.stdout } : 'Aucun détail.' },
        { status: 500 },
      );
    }
  }

  // ── Chemin Windows (SSH + PowerShell) ─────────────────────────────────────

  try {
    const data = await runSshWindowsMetrics(host);

    const responsePayload = {
      ok: true,
      host: data.host,
      cpu: data.cpu,
      memory: data.memory,
      disk: data.disk,
      uptime: data.uptime,
      subnetMask: null,
      diskTotal: data.diskTotal,
      diskFree: data.diskFree,
      memTotal: data.memTotal,
      memFree: data.memFree,
      stoppedServices: [] as string[],
    };

    try {
      await persistMonitoringSnapshot({
        servers: [{
          id: `remote-${host}`, name: responsePayload.host, ipAddress: host, status: 'online',
          healthScore: Math.round(100 - Math.max(responsePayload.cpu, responsePayload.memory, responsePayload.disk)),
          metrics: { cpuUsage: responsePayload.cpu, memoryUsage: responsePayload.memory, diskUsage: responsePayload.disk, uptime: responsePayload.uptime, networkIn: 0, networkOut: 0, processCount: 0 },
          lastHealthCheck: new Date(), services: [],
        }],
      });
    } catch { /* DB failure non bloquante */ }

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    const rootErr = err?.err || err;
    const message = rootErr?.message || err?.message || 'Unknown error';
    const isTimeout = Boolean(rootErr?.killed) || /timed out|ETIMEDOUT/i.test(String(message));
    captureSystemEvents.connectivityIssue(host, host, 'SSH/Windows', message);
    const details = debug
      ? { message, stderr: err?.stderr || null, stdout: err?.stdout || null, isTimeout }
      : 'Aucun détail.';
    return NextResponse.json(
      { ok: false, error: isTimeout ? 'Timeout de récupération distante.' : 'Erreur de récupération distante.', details },
      { status: 500 },
    );
  }
}
