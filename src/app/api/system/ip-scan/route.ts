import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';

const execAsync = promisify(exec);

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
  return parts.every((p) => { const n = Number(p); return /^\d+$/.test(p) && n >= 0 && n <= 255; });
}
export function parseRange(range: string): string[] {
  const MAX = 1024; const s = range.trim();
  const cidrM = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (cidrM) {
    const prefix = parseInt(cidrM[2]); if (prefix < 8 || prefix > 30) return [];
    const base = ipToInt(cidrM[1]) & (~((1 << (32 - prefix)) - 1) >>> 0);
    const size = Math.min((1 << (32 - prefix)) - 2, MAX);
    return Array.from({ length: size }, (_, i) => intToIp(base + 1 + i));
  }
  const shortM = s.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})-(\d{1,3})$/);
  if (shortM) {
    const base = shortM[1]; const start = parseInt(shortM[2]); const end = parseInt(shortM[3]);
    const ips: string[] = []; for (let i = start; i <= end && ips.length < MAX; i++) ips.push(`${base}${i}`); return ips;
  }
  const fullM = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (fullM) {
    const sn = ipToInt(fullM[1]); const en = ipToInt(fullM[2]);
    const ips: string[] = []; for (let i = sn; i <= en && ips.length < MAX; i++) ips.push(intToIp(i)); return ips;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s)) return [s];
  return [];
}

async function pingHost(ip: string, isWindows: boolean): Promise<{ reachable: boolean; latencyMs?: number }> {
  const cmd = isWindows ? `ping -n 1 -w 400 ${ip}` : `ping -c 1 -W 1 ${ip}`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 3500 });
    const reachable = isWindows ? /TTL=/i.test(stdout) : /\d bytes from/i.test(stdout);
    if (!reachable) return { reachable: false };
    // Windows FR: "temps=101 ms" or "temps<1 ms" ; EN: "time=5ms" or "time<1ms"
    const m = stdout.match(/temps?[<=](\d+)/i) ?? stdout.match(/[<=](\d+)\s*ms/i);
    return { reachable: true, latencyMs: m ? parseInt(m[1]) : undefined };
  } catch { return { reachable: false }; }
}

/** Build ARP map: try Get-NetNeighbor (Windows) then fall back to arp -a */
async function buildArpTable(isWindows: boolean): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (isWindows) {
    try {
      const ps = `Get-NetNeighbor -AddressFamily IPv4 | ` +
        `Where-Object { $_.LinkLayerAddress -ne '00-00-00-00-00-00' -and $_.LinkLayerAddress -ne 'FF-FF-FF-FF-FF-FF' } | ` +
        `Select-Object IPAddress,LinkLayerAddress | ConvertTo-Json -Compress`;
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${ps}"`, { timeout: 5000 });
      const text = stdout.trim();
      if (text) {
        const entries = JSON.parse(text);
        const arr = Array.isArray(entries) ? entries : [entries];
        for (const e of arr) {
          if (e?.IPAddress && e?.LinkLayerAddress)
            map.set(e.IPAddress, e.LinkLayerAddress.replace(/-/g, ':').toLowerCase());
        }
        if (map.size > 0) return map;
      }
    } catch { /* fall through to arp -a */ }
  }
  try {
    const { stdout } = await execAsync('arp -a', { timeout: 3000 });
    for (const line of stdout.split('\n')) {
      const ipM = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      const macM = line.match(/([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})/i);
      if (ipM && macM) map.set(ipM[1], macM[1].replace(/-/g, ':').toLowerCase());
    }
  } catch { /* ignore */ }
  return map;
}

async function resolveHostname(ip: string, isWindows: boolean): Promise<string | undefined> {
  // Try PowerShell Resolve-DnsName (uses DNS + WINS + NetBIOS, more powerful than GetHostEntry)
  if (isWindows) {
    try {
      const ps = `Resolve-DnsName -Name ${ip} -Type PTR -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty NameHost`;
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${ps}"`,
        { timeout: 3000 }
      );
      const name = stdout.trim();
      if (name && name !== ip && !name.includes('ERROR')) return name;
    } catch { /* fall through */ }
  }
  // Fallback: standard Node DNS reverse
  try {
    const names = await Promise.race([
      dns.promises.reverse(ip),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
    ]) as string[];
    return names[0] ?? undefined;
  } catch { return undefined; }
}

async function pool(items: string[], concurrency: number, fn: (ip: string) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) { const ip = queue.shift()!; await fn(ip); }
  });
  await Promise.allSettled(workers);
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') ?? '';
  const ips = parseRange(range).filter(validateIp);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (event: string, data: object) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
        catch { /* stream closed */ }
      };

      if (ips.length === 0) {
        enq('error', { message: 'Plage IP invalide ou vide (max 1024 adresses).' });
        controller.close(); return;
      }

      const isWindows = process.platform === 'win32';
      const total = ips.length;
      let scanned = 0; let reachableCount = 0;
      const t0 = Date.now();
      const reachableIps: string[] = [];

      enq('start', { total });

      // ── Phase 1: Ping scan (30 concurrent) ──────────────────────────────────
      await pool(ips, 30, async (ip) => {
        const { reachable, latencyMs } = await pingHost(ip, isWindows);
        scanned++;
        if (reachable) { reachableCount++; reachableIps.push(ip); }
        enq('result', { ip, reachable, latencyMs, resolving: reachable });
        enq('progress', { scanned, total });
      });

      // ── Phase 2: Resolve MAC + hostname (unconditional — never skip) ─────────
      if (reachableIps.length > 0) {
        const arpTable = await buildArpTable(isWindows);
        await pool(reachableIps, 10, async (ip) => {
          const hostname = await resolveHostname(ip, isWindows);
          const mac = arpTable.get(ip) ?? null;
          enq('update', { ip, hostname: hostname ?? null, mac });
        });
      }

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
