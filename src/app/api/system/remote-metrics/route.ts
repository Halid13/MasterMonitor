import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { captureSystemEvents } from '@/services/eventCapture';

const { MM_REMOTE_USER, MM_REMOTE_PASS } = process.env;

const isSafeHost = (value: string) => /^[a-zA-Z0-9.-]+$/.test(value);

const runPowerShell = (command: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const tmpFile = join(tmpdir(), `ps-${Date.now()}.ps1`);
    try {
      writeFileSync(tmpFile, command, 'utf8');
      exec(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { maxBuffer: 1024 * 1024, encoding: 'utf8' },
        (err, stdout, stderr) => {
          try { unlinkSync(tmpFile); } catch {}
          if (err) return reject({ err, stdout, stderr });
          resolve({ stdout, stderr: stderr || '' });
        },
      );
    } catch (e) {
      try { unlinkSync(tmpFile); } catch {}
      reject(e);
    }
  });

export async function GET(request: Request) {
  if (!MM_REMOTE_USER || !MM_REMOTE_PASS) {
    return NextResponse.json(
      { ok: false, error: 'Credentials WinRM manquants.' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const host = String(searchParams.get('host') || '').trim();
  const debug = searchParams.get('debug') === '1';
  if (!host || !isSafeHost(host)) {
    return NextResponse.json(
      { ok: false, error: 'Hôte invalide.' },
      { status: 400 },
    );
  }

  const ps = `
$ErrorActionPreference = 'Stop';
try {
  $pass = ConvertTo-SecureString '${MM_REMOTE_PASS}' -AsPlainText -Force;
  $cred = New-Object System.Management.Automation.PSCredential('${MM_REMOTE_USER}', $pass);
  
  $result = Invoke-Command -ComputerName ${host} -Credential $cred -ScriptBlock {
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average;
    $os = Get-CimInstance Win32_OperatingSystem;
    $sys = Get-CimInstance Win32_ComputerSystem;
    $disk = Get-CimInstance Win32_LogicalDisk -Filter 'DeviceID=''C:''';
    $memTotal = $os.TotalVisibleMemorySize * 1024;
    $memFree = $os.FreePhysicalMemory * 1024;
    $memUsedPct = (($memTotal - $memFree) / $memTotal) * 100;
    $diskPct = (($disk.Size - $disk.FreeSpace) / $disk.Size) * 100;
    $uptimeSec = (New-TimeSpan -Start $os.LastBootUpTime -End (Get-Date)).TotalSeconds;
    
    [PSCustomObject]@{
      ok = $true;
      host = $sys.Name;
      cpu = [Math]::Round($cpu, 2);
      memory = [Math]::Round($memUsedPct, 2);
      disk = [Math]::Round($diskPct, 2);
      uptime = [int]$uptimeSec;
    }
  };
  
  $result | ConvertTo-Json -Compress | Write-Output;
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message);
}
`;

  try {
    const { stdout, stderr } = await runPowerShell(ps);
    
    if (debug) {
      console.log('=== DEBUG WinRM ===');
      console.log('STDOUT:', stdout);
      console.log('STDERR:', stderr);
      console.log('==================');
    }
    
    const jsonStart = stdout.indexOf('{');
    const payload = jsonStart >= 0 ? stdout.slice(jsonStart).trim() : '';
    const data = payload ? JSON.parse(payload) : null;
    if (!data?.ok) {
      captureSystemEvents.connectivityIssue(host, host, 'WinRM', 'Remote metrics returned error');
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Erreur WinRM.', 
          details: debug ? { stderr, stdout } : 'Aucun détail.' 
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
    captureSystemEvents.connectivityIssue(host, host, 'WinRM', err?.message || 'Unknown error');
    const details = debug
      ? {
          message: err?.message || 'Erreur inconnue',
          stderr: err?.stderr || null,
          stdout: err?.stdout || null,
        }
      : 'Aucun détail.';
    return NextResponse.json(
      { ok: false, error: 'Erreur WinRM.', details },
      { status: 500 },
    );
  }
}
