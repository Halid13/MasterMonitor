import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';

const execAsync = promisify(exec);

// ─── IP helpers ──────────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function intToIp(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

function validateIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return /^\d+$/.test(p) && n >= 0 && n <= 255;
  });
}

function parseRange(range: string): string[] {
  const MAX = 1024;
  const s = range.trim();

  // CIDR: 192.168.1.0/24
  const cidrM = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (cidrM) {
    const prefix = parseInt(cidrM[2]);
    if (prefix < 8 || prefix > 30) return [];
    const base = ipToInt(cidrM[1]) & (~((1 << (32 - prefix)) - 1) >>> 0);
    const size = Math.min((1 << (32 - prefix)) - 2, MAX);
    return Array.from({ length: size }, (_, i) => intToIp(base + 1 + i));
  }

  // Short range: 192.168.1.1-254
  const shortM = s.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})-(\d{1,3})$/);
  if (shortM) {
    const base = shortM[1];
    const start = Math.max(0, parseInt(shortM[2]));
    const end = Math.min(255, parseInt(shortM[3]));
    const ips: string[] = [];
    for (let i = start; i <= end && ips.length < MAX; i++) ips.push(`${base}${i}`);
    return ips;
  }

  // Full range: 192.168.1.1-192.168.1.50
  const fullM = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (fullM) {
    const start = ipToInt(fullM[1]);
    const end = ipToInt(fullM[2]);
    const ips: string[] = [];
    for (let i = start; i <= end && ips.length < MAX; i++) ips.push(intToIp(i));
    return ips;
  }

  // Single IP
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s)) return [s];

  return [];
}

// ─── Probe helpers ────────────────────────────────────────────────────────────

async function pingHost(
  ip: string,
  isWindows: boolean,
): Promise<{ reachable: boolean; latencyMs?: number }> {
  const cmd = isWindows ? `ping -n 1 -w 400 ${ip}` : `ping -c 1 -W 1 ${ip}`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 3500 });
    const reachable = isWindows ? /TTL=/i.test(stdout) : /\d bytes from/i.test(stdout);
    if (!reachable) return { reachable: false };
    const m = stdout.match(/time[<=](\d+)/i);
    return { reachable: true, latencyMs: m ? parseInt(m[1]) : 0 };
  } catch {
    return { reachable: false };
  }
}

async function getMac(ip: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`arp -a ${ip}`, { timeout: 1000 });
    const m = stdout.match(/([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})/i);
    return m ? m[1].replace(/-/g, ':') : undefined;
  } catch {
    return undefined;
  }
}

async function reverseDns(ip: string): Promise<string | undefined> {
  try {
    const names = await dns.promises.reverse(ip);
    return names[0] ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function pool(
  items: string[],
  concurrency: number,
  fn: (ip: string) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0 && !signal.aborted) {
      const ip = queue.shift()!;
      await fn(ip);
    }
  });
  await Promise.allSettled(workers);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') ?? '';
  const ips = parseRange(range).filter(validateIp);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: object) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      if (ips.length === 0) {
        enq('error', { message: 'Plage IP invalide ou vide (max 1024 adresses).' });
        controller.close();
        return;
      }

      const isWindows = process.platform === 'win32';
      const total = ips.length;
      let scanned = 0;
      let reachableCount = 0;
      const t0 = Date.now();

      enq('start', { total });

      await pool(
        ips,
        30,
        async (ip) => {
          const { reachable, latencyMs } = await pingHost(ip, isWindows);
          scanned++;
          if (reachable) reachableCount++;

          let hostname: string | undefined;
          let mac: string | undefined;
          if (reachable) {
            [hostname, mac] = await Promise.all([reverseDns(ip), getMac(ip)]);
          }

          enq('result', { ip, reachable, latencyMs, hostname, mac });
          enq('progress', { scanned, total });
        },
        req.signal,
      );

      enq('done', { total, reachable: reachableCount, elapsed: Date.now() - t0 });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
