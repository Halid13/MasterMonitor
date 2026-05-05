import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export interface LocalIPEntry {
  address: string;
  mac?: string;
  type: 'local' | 'arp-dynamic' | 'arp-static';
  iface?: string;
  family?: string;
}

function getLocalInterfaces(): LocalIPEntry[] {
  const ifaces = os.networkInterfaces();
  const result: LocalIPEntry[] = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal) continue;
      if (addr.family !== 'IPv4') continue;
      result.push({
        address: addr.address,
        mac: addr.mac,
        type: 'local',
        iface: name,
        family: addr.family,
      });
    }
  }
  return result;
}

function parseArpWindows(output: string): LocalIPEntry[] {
  const entries: LocalIPEntry[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Match lines like:  192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic
    const match = line.match(/^\s+([\d.]+)\s+([\w-]+)\s+(dynamic|static)\s*$/i);
    if (!match) continue;
    const [, address, mac, type] = match;
    // Skip broadcast / multicast
    if (address.endsWith('.255') || address.startsWith('224.') || address.startsWith('239.')) continue;
    entries.push({
      address,
      mac: mac.replace(/-/g, ':'),
      type: type.toLowerCase() === 'static' ? 'arp-static' : 'arp-dynamic',
    });
  }
  return entries;
}

function parseArpLinux(output: string): LocalIPEntry[] {
  const entries: LocalIPEntry[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Format: hostname (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
    const match = line.match(/\(?([\d.]+)\)?\s+at\s+([\w:]+)\s+.*on\s+(\S+)/i);
    if (!match) continue;
    const [, address, mac, iface] = match;
    if (address.endsWith('.255') || address.startsWith('224.')) continue;
    entries.push({ address, mac, type: 'arp-dynamic', iface });
  }
  return entries;
}

export async function GET() {
  const local = getLocalInterfaces();

  let arpEntries: LocalIPEntry[] = [];
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'arp -a' : 'arp -n';
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    arpEntries = isWindows ? parseArpWindows(stdout) : parseArpLinux(stdout);
  } catch {
    // ARP not available or failed — return only local interfaces
  }

  // Merge: deduplicate by address (local takes priority)
  const localAddresses = new Set(local.map((e) => e.address));
  const dedupedArp = arpEntries.filter((e) => !localAddresses.has(e.address));

  const all = [...local, ...dedupedArp].sort((a, b) => {
    const toInt = (ip: string) => ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
    return toInt(a.address) - toInt(b.address);
  });

  return NextResponse.json({ ok: true, entries: all, total: all.length });
}
