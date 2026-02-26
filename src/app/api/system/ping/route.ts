import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { persistMonitoringSnapshot } from '@/lib/monitoring-db';

const isSafeTarget = (value: string) => /^[a-zA-Z0-9._:-]+$/.test(value);

const runCommand = (command: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject({ error, stdout, stderr });
        return;
      }
      resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });

const runWindowsPing = async (target: string, count: number) => {
  const escapedTarget = target.replace(/'/g, "''");
  const psCommand = [
    "$ErrorActionPreference = 'Stop'",
    `$sent = ${count}`,
    `$results = Test-Connection -ComputerName '${escapedTarget}' -Count ${count} -ErrorAction SilentlyContinue`,
    '$received = @($results).Count',
    "$avg = if ($received -gt 0) { [Math]::Round((($results | Measure-Object -Property ResponseTime -Average).Average), 2) } else { $null }",
    '[PSCustomObject]@{ sent = $sent; received = $received; avgLatency = $avg; reachable = ($received -gt 0) } | ConvertTo-Json -Compress',
  ].join('; ');

  const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`;

  try {
    const { stdout, stderr } = await runCommand(command);
    const jsonStart = stdout.indexOf('{');
    if (jsonStart >= 0) {
      const parsed = JSON.parse(stdout.slice(jsonStart).trim());
      return {
        sent: Number(parsed.sent ?? count),
        received: Number(parsed.received ?? 0),
        avgLatency: parsed.avgLatency == null ? null : Number(parsed.avgLatency),
        reachable: Boolean(parsed.reachable),
        output: stdout,
        errorOutput: stderr,
      };
    }
  } catch {
    // fallback below
  }

  const fallbackCommand = `ping -n ${count} ${target}`;
  try {
    const { stdout, stderr } = await runCommand(fallbackCommand);
    const stats = parsePingStats(stdout);
    return {
      ...stats,
      output: stdout,
      errorOutput: stderr,
    };
  } catch (error: any) {
    return {
      sent: count,
      received: 0,
      avgLatency: null as number | null,
      reachable: false,
      output: '',
      errorOutput: error?.stderr || error?.message || 'Erreur inconnue',
    };
  }
};

const parsePingStats = (output: string) => {
  const sentMatch = output.match(/(?:Sent|envoyés?)\s*[=:]\s*(\d+)/i) || output.match(/(\d+)\s+packets\s+transmitted/i);
  const receivedMatch = output.match(/(?:Received|reçus?)\s*[=:]\s*(\d+)/i) || output.match(/transmitted\s*,\s*(\d+)\s+(?:packets\s+)?received/i);

  const avgMatch = output.match(/(?:Average|Moyenne)\s*[=:]\s*(\d+)\s*ms/i)
    || output.match(/(?:round-trip|rtt).*?=\s*\d+(?:\.\d+)?\/(\d+(?:\.\d+)?)\//i)
    || output.match(/(?:avg)\s*[=:]\s*(\d+(?:\.\d+)?)/i);

  const sent = sentMatch ? Number(sentMatch[1]) : 0;
  const received = receivedMatch ? Number(receivedMatch[1]) : 0;
  const avgLatency = avgMatch ? Number(avgMatch[1]) : null;

  return {
    sent,
    received,
    avgLatency,
    reachable: received > 0,
  };
};

export async function GET(request: NextRequest) {
  const target = String(request.nextUrl.searchParams.get('target') || '').trim();
  const countRaw = Number(request.nextUrl.searchParams.get('count') || '4');
  const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(10, Math.floor(countRaw))) : 4;

  if (!target || !isSafeTarget(target)) {
    return NextResponse.json({ ok: false, error: 'Cible invalide.' }, { status: 400 });
  }

  try {
    const startedAt = Date.now();

    let stats: { sent: number; received: number; avgLatency: number | null; reachable: boolean };
    let rawOutput = '';
    let errorOutput = '';

    if (process.platform === 'win32') {
      const result = await runWindowsPing(target, count);
      stats = {
        sent: result.sent,
        received: result.received,
        avgLatency: result.avgLatency,
        reachable: result.reachable,
      };
      rawOutput = result.output || '';
      errorOutput = result.errorOutput || '';
    } else {
      const command = `ping -c ${count} ${target}`;
      const { stdout, stderr } = await runCommand(command);
      rawOutput = stdout;
      errorOutput = stderr;
      stats = parsePingStats(stdout);
    }

    const payload = {
      ok: true,
      target,
      elapsedMs: Date.now() - startedAt,
      sent: stats.sent,
      received: stats.received,
      avgLatencyMs: stats.avgLatency,
      reachable: stats.reachable,
      output: rawOutput || undefined,
      errorOutput: errorOutput || undefined,
    };

    try {
      await persistMonitoringSnapshot({
        pingResults: [
          {
            id: `ping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            target,
            elapsedMs: payload.elapsedMs,
            sent: payload.sent,
            received: payload.received,
            avgLatencyMs: payload.avgLatencyMs,
            reachable: payload.reachable,
          },
        ],
      });
    } catch {
      // keep ping endpoint available even if DB temporarily fails
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        target,
        error: 'Échec du test ICMP.',
        details: error?.stderr || error?.message || 'Erreur inconnue.',
      },
      { status: 500 },
    );
  }
}
