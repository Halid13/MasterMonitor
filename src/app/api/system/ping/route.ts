import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

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

  const command = process.platform === 'win32'
    ? `ping -n ${count} ${target}`
    : `ping -c ${count} ${target}`;

  try {
    const startedAt = Date.now();
    const { stdout, stderr } = await runCommand(command);
    const stats = parsePingStats(stdout);

    return NextResponse.json({
      ok: true,
      target,
      elapsedMs: Date.now() - startedAt,
      sent: stats.sent,
      received: stats.received,
      avgLatencyMs: stats.avgLatency,
      reachable: stats.reachable,
      output: stdout,
      errorOutput: stderr || undefined,
    });
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
