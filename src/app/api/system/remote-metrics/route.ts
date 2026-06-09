import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { captureSystemEvents } from '@/services/eventCapture';
import { persistMonitoringSnapshot } from '@/lib/monitoring-db';

const { MM_REMOTE_USER, MM_REMOTE_PASS, MM_SSH_USER, MM_SSH_PASS } = process.env;
const REMOTE_METRICS_TIMEOUT_MS = (() => {
  const raw = Number(process.env.MM_REMOTE_TIMEOUT_MS || '65000');
  if (!Number.isFinite(raw)) return 65_000;
  return Math.max(10_000, Math.min(180_000, Math.floor(raw)));
})();

const isSafeHost = (value: string) => /^[a-zA-Z0-9._:-]+$/.test(value);
const escapePsSingleQuoted = (value: string) => value.replace(/'/g, "''");

// Sur Linux le binaire s'appelle pwsh, sur Windows powershell.exe
const PS_EXE = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';

// ─── Windows : PowerShell WinRM/CIM ──────────────────────────────────────────

const runPowerShell = (command: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const tmpFile = join(tmpdir(), `ps-${Date.now()}-${randomUUID()}.ps1`);
    try {
      writeFileSync(tmpFile, command, 'utf8');
      exec(
        `${PS_EXE} -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { maxBuffer: 1024 * 1024, encoding: 'utf8', timeout: REMOTE_METRICS_TIMEOUT_MS },
        (err, stdout, stderr) => {
          try { unlinkSync(tmpFile); } catch {}
          if (err) return reject({ err, stdout, stderr });
          resolve({ stdout: stdout || '', stderr: stderr || '' });
        },
      );
    } catch (error) {
      try { unlinkSync(tmpFile); } catch {}
      reject(error);
    }
  });

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

  // ── Chemin Windows (PowerShell WinRM/CIM) ───────────────────────────────────
  const useExplicitCreds = Boolean(MM_REMOTE_USER && MM_REMOTE_PASS);
  const psHost = escapePsSingleQuoted(host);
  const psUser = escapePsSingleQuoted(MM_REMOTE_USER || '');
  const psPass = escapePsSingleQuoted(MM_REMOTE_PASS || '');

  const ps = `
Import-Module PSWSMan -ErrorAction SilentlyContinue
$ErrorActionPreference = 'Stop'

$target = '${psHost}'
$cred = $null
if (${useExplicitCreds ? '$true' : '$false'}) {
  $pass = ConvertTo-SecureString '${psPass}' -AsPlainText -Force
  $cred = New-Object System.Management.Automation.PSCredential('${psUser}', $pass)
}

$collect = {
  $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $os = Get-CimInstance Win32_OperatingSystem
  $sys = Get-CimInstance Win32_ComputerSystem
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  $memTotal = $os.TotalVisibleMemorySize * 1024
  $memFree = $os.FreePhysicalMemory * 1024
  $memUsedPct = if ($memTotal -gt 0) { (($memTotal - $memFree) / $memTotal) * 100 } else { 0 }
  $diskPct = if ($disk.Size -gt 0) { (($disk.Size - $disk.FreeSpace) / $disk.Size) * 100 } else { 0 }
  $uptimeSec = (New-TimeSpan -Start $os.LastBootUpTime -End (Get-Date)).TotalSeconds
  $netCfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" | Select-Object -First 1
  $subnetMask = if ($netCfg -and $netCfg.IPSubnet) { $netCfg.IPSubnet[0] } else { $null }
  $stoppedSvcs = @(try {
    Get-CimInstance Win32_Service -Filter "StartMode='Auto' AND State='Stopped'" -ErrorAction SilentlyContinue |
    Select-Object -First 6 -ExpandProperty Name
  } catch { })
  [PSCustomObject]@{
    ok = $true; host = $sys.Name; cpu = [Math]::Round($cpu, 2); memory = [Math]::Round($memUsedPct, 2)
    disk = [Math]::Round($diskPct, 2); uptime = [int]$uptimeSec; subnetMask = $subnetMask
    diskTotal = $disk.Size; diskFree = $disk.FreeSpace; memTotal = $memTotal; memFree = $memFree
    stoppedServices = @($stoppedSvcs)
  }
}

try {
  if ($cred) {
    $result = Invoke-Command -ComputerName $target -Credential $cred -Authentication Basic -ScriptBlock $collect -ErrorAction Stop
  } else {
    $result = Invoke-Command -ComputerName $target -Authentication Basic -ScriptBlock $collect -ErrorAction Stop
  }
  $result | ConvertTo-Json -Compress | Write-Output
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
}
`;

  try {
    const { stdout, stderr } = await runPowerShell(ps);

    if (debug) {
      console.log('=== DEBUG Remote Metrics ===');
      console.log('STDOUT:', stdout);
      console.log('STDERR:', stderr);
      console.log('============================');
    }

    const jsonStart = stdout.indexOf('{');
    const payload = jsonStart >= 0 ? stdout.slice(jsonStart).trim() : '';
    const data = payload ? JSON.parse(payload) : null;

    if (!data?.ok) {
      captureSystemEvents.connectivityIssue(host, host, 'WinRM/DCOM', 'Remote metrics returned error');
      return NextResponse.json(
        { ok: false, error: 'Erreur de récupération distante.', details: debug ? { stderr, stdout } : 'Aucun détail.' },
        { status: 500 },
      );
    }

    const rawStopped = data.stoppedServices;
    const stoppedServices: string[] = Array.isArray(rawStopped)
      ? rawStopped.filter(Boolean)
      : rawStopped ? [String(rawStopped)] : [];

    const responsePayload = {
      ok: true,
      host: data.host || host,
      cpu: data.cpu ?? 0,
      memory: data.memory ?? 0,
      disk: data.disk ?? 0,
      uptime: data.uptime ?? 0,
      subnetMask: data.subnetMask ?? null,
      diskTotal: data.diskTotal ?? null,
      diskFree: data.diskFree ?? null,
      memTotal: data.memTotal ?? null,
      memFree: data.memFree ?? null,
      stoppedServices,
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
    captureSystemEvents.connectivityIssue(host, host, 'WinRM/DCOM', message);
    const details = debug
      ? { message, stderr: err?.stderr || null, stdout: err?.stdout || null, timeoutMs: REMOTE_METRICS_TIMEOUT_MS, isTimeout }
      : 'Aucun détail.';
    return NextResponse.json(
      { ok: false, error: isTimeout ? 'Timeout de récupération distante.' : 'Erreur de récupération distante.', details },
      { status: 500 },
    );
  }
}
