import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { captureSystemEvents } from '@/services/eventCapture';

const { MM_REMOTE_USER, MM_REMOTE_PASS } = process.env;

const isSafeHost = (value: string) => /^[a-zA-Z0-9._:-]+$/.test(value);

const escapePsSingleQuoted = (value: string) => value.replace(/'/g, "''");

const runPowerShell = (command: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const tmpFile = join(tmpdir(), `ps-${Date.now()}-${randomUUID()}.ps1`);

    try {
      writeFileSync(tmpFile, command, 'utf8');
      exec(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { maxBuffer: 1024 * 1024, encoding: 'utf8' },
        (err, stdout, stderr) => {
          try {
            unlinkSync(tmpFile);
          } catch {}

          if (err) {
            return reject({ err, stdout, stderr });
          }
          resolve({ stdout, stderr: stderr || '' });
        },
      );
    } catch (error) {
      try {
        unlinkSync(tmpFile);
      } catch {}
      reject(error);
    }
  });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = String(searchParams.get('host') || '').trim();
  const debug = searchParams.get('debug') === '1';

  if (!host || !isSafeHost(host)) {
    return NextResponse.json({ ok: false, error: 'Hôte invalide.' }, { status: 400 });
  }

  const useExplicitCreds = Boolean(MM_REMOTE_USER && MM_REMOTE_PASS);
  const psHost = escapePsSingleQuoted(host);
  const psUser = escapePsSingleQuoted(MM_REMOTE_USER || '');
  const psPass = escapePsSingleQuoted(MM_REMOTE_PASS || '');

  const ps = `
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

  [PSCustomObject]@{
    ok = $true
    host = $sys.Name
    cpu = [Math]::Round($cpu, 2)
    memory = [Math]::Round($memUsedPct, 2)
    disk = [Math]::Round($diskPct, 2)
    uptime = [int]$uptimeSec
  }
}

$invokeError = $null
try {
  if ($cred) {
    $result = Invoke-Command -ComputerName $target -Credential $cred -ScriptBlock $collect -ErrorAction Stop
  } else {
    $result = Invoke-Command -ComputerName $target -ScriptBlock $collect -ErrorAction Stop
  }

  $result | ConvertTo-Json -Compress | Write-Output
  exit 0
} catch {
  $invokeError = $_.Exception.Message
}

try {
  $sessionOptions = New-CimSessionOption -Protocol Dcom
  if ($cred) {
    $cim = New-CimSession -ComputerName $target -Credential $cred -SessionOption $sessionOptions -ErrorAction Stop
  } else {
    $cim = New-CimSession -ComputerName $target -SessionOption $sessionOptions -ErrorAction Stop
  }

  try {
    $cpu = (Get-CimInstance Win32_Processor -CimSession $cim | Measure-Object -Property LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem -CimSession $cim
    $sys = Get-CimInstance Win32_ComputerSystem -CimSession $cim
    $disk = Get-CimInstance Win32_LogicalDisk -CimSession $cim -Filter "DeviceID='C:'"
    $memTotal = $os.TotalVisibleMemorySize * 1024
    $memFree = $os.FreePhysicalMemory * 1024
    $memUsedPct = if ($memTotal -gt 0) { (($memTotal - $memFree) / $memTotal) * 100 } else { 0 }
    $diskPct = if ($disk.Size -gt 0) { (($disk.Size - $disk.FreeSpace) / $disk.Size) * 100 } else { 0 }
    $uptimeSec = (New-TimeSpan -Start $os.LastBootUpTime -End (Get-Date)).TotalSeconds

    [PSCustomObject]@{
      ok = $true
      host = $sys.Name
      cpu = [Math]::Round($cpu, 2)
      memory = [Math]::Round($memUsedPct, 2)
      disk = [Math]::Round($diskPct, 2)
      uptime = [int]$uptimeSec
    } | ConvertTo-Json -Compress | Write-Output
  } finally {
    if ($cim) {
      Remove-CimSession -CimSession $cim -ErrorAction SilentlyContinue
    }
  }
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message + ' | Invoke-Command: ' + $invokeError)
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
        {
          ok: false,
          error: 'Erreur de récupération distante.',
          details: debug ? { stderr, stdout } : 'Aucun détail.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      host: data.host || host,
      cpu: data.cpu ?? 0,
      memory: data.memory ?? 0,
      disk: data.disk ?? 0,
      uptime: data.uptime ?? 0,
    });
  } catch (err: any) {
    captureSystemEvents.connectivityIssue(host, host, 'WinRM/DCOM', err?.message || 'Unknown error');
    const details = debug
      ? {
          message: err?.message || 'Erreur inconnue',
          stderr: err?.stderr || null,
          stdout: err?.stdout || null,
        }
      : 'Aucun détail.';

    return NextResponse.json({ ok: false, error: 'Erreur de récupération distante.', details }, { status: 500 });
  }
}
