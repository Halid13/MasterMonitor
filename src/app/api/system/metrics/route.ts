import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { captureSystemEvents } from '@/services/eventCapture';
import { logger } from '@/services/logger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const cpuSnapshot = () => os.cpus().map((cpu) => cpu.times);

const getCpuUsage = async () => {
  const start = cpuSnapshot();
  await sleep(120);
  const end = cpuSnapshot();

  let idle = 0;
  let total = 0;

  for (let i = 0; i < start.length; i++) {
    const s = start[i];
    const e = end[i];
    const idleDelta = e.idle - s.idle;
    const totalDelta =
      (e.user - s.user) +
      (e.nice - s.nice) +
      (e.sys - s.sys) +
      (e.idle - s.idle) +
      (e.irq - s.irq);
    idle += idleDelta;
    total += totalDelta;
  }

  const usage = total > 0 ? (1 - idle / total) * 100 : 0;
  return Math.min(100, Math.max(0, Number(usage.toFixed(2))));
};

const getDiskUsageWindows = async (driveLetter = 'C') =>
  new Promise<{ total: number; free: number; used: number; percent: number } | null>((resolve) => {
    exec(
      `wmic logicaldisk where DeviceID="${driveLetter}:" get Size,FreeSpace /value`,
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const sizeMatch = stdout.match(/Size=(\d+)/i);
        const freeMatch = stdout.match(/FreeSpace=(\d+)/i);
        if (!sizeMatch || !freeMatch) return resolve(null);
        const total = Number(sizeMatch[1]);
        const free = Number(freeMatch[1]);
        const used = total - free;
        const percent = total > 0 ? (used / total) * 100 : 0;
        resolve({ total, free, used, percent: Number(percent.toFixed(2)) });
      },
    );
  });

type NetSample = { rx: number; tx: number; ts: number };
let lastNetSample: NetSample | null = null;

const ANOMALY_COOLDOWN_MS = 60_000;
const anomalyState = {
  cpu: { active: false, lastAt: 0 },
  memory: { active: false, lastAt: 0 },
  disk: { active: false, lastAt: 0 },
  load: { active: false, lastAt: 0 },
};

const checkAnomaly = (
  metric: keyof typeof anomalyState,
  value: number,
  threshold: number,
  serverId: string,
  serverName: string,
) => {
  const now = Date.now();
  const state = anomalyState[metric];

  if (value >= threshold) {
    if (!state.active || now - state.lastAt > ANOMALY_COOLDOWN_MS) {
      captureSystemEvents.metricsAnomalyDetected(serverId, serverName, metric.toUpperCase(), value, threshold);
      state.active = true;
      state.lastAt = now;
    }
    return;
  }

  if (state.active) {
    logger.logSystem(
      `Anomaly Resolved: ${metric.toUpperCase()} back to normal`,
      `${serverName} (${serverId})`,
      'info',
      { metric, value, threshold },
    );
    state.active = false;
    state.lastAt = now;
  }
};

const parseNetstatWindows = (output: string) => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const bytesLine = lines.find((line) => /(bytes|octets)/i.test(line));
  if (bytesLine) {
    const values = bytesLine.match(/\d+/g);
    if (values && values.length >= 2) {
      return { rx: Number(values[0]), tx: Number(values[1]) };
    }
  }

  const fallbackLine = lines.find((line) => {
    const values = line.match(/\d+/g);
    return values != null && values.length >= 2;
  });

  if (fallbackLine) {
    const values = fallbackLine.match(/\d+/g);
    if (values && values.length >= 2) {
      return { rx: Number(values[0]), tx: Number(values[1]) };
    }
  }

  return null;
};

const getNetworkBytesWindows = async () =>
  new Promise<{ rx: number; tx: number } | null>((resolve) => {
    exec('netstat -e', (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const parsed = parseNetstatWindows(stdout);
      resolve(parsed);
    });
  });

const getNetworkBytesLinux = async () =>
  new Promise<{ rx: number; tx: number } | null>((resolve) => {
    exec('cat /proc/net/dev', (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const lines = stdout.split('\n').slice(2);
      let rx = 0;
      let tx = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [iface, rest] = trimmed.split(':');
        if (!rest) continue;
        const cols = rest.trim().split(/\s+/);
        const ifaceName = iface.trim();
        if (ifaceName === 'lo') continue;
        const rxBytes = Number(cols[0] || 0);
        const txBytes = Number(cols[8] || 0);
        rx += rxBytes;
        tx += txBytes;
      }
      resolve({ rx, tx });
    });
  });

const getNetworkRate = async () => {
  const now = Date.now();
  const bytes = process.platform === 'win32'
    ? await getNetworkBytesWindows()
    : await getNetworkBytesLinux();

  if (!bytes) return { incoming: 0, outgoing: 0 };

  if (!lastNetSample) {
    lastNetSample = { ...bytes, ts: now };
    return { incoming: 0, outgoing: 0 };
  }

  const dt = (now - lastNetSample.ts) / 1000;
  const incoming = dt > 0 ? (bytes.rx - lastNetSample.rx) / dt : 0;
  const outgoing = dt > 0 ? (bytes.tx - lastNetSample.tx) / dt : 0;

  lastNetSample = { ...bytes, ts: now };

  return {
    incoming: Number(Math.max(0, incoming).toFixed(2)),
    outgoing: Number(Math.max(0, outgoing).toFixed(2)),
  };
};

const getPrimaryNetwork = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const iface = nets[name] || [];
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return { ip: addr.address, netmask: addr.netmask, name };
      }
    }
  }
  return { ip: null, netmask: null, name: null };
};

export async function GET() {
  const cpu = await getCpuUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memory = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;
  const loadAvg = os.loadavg?.()[0] ?? 0;
  const cpuCount = os.cpus().length || 1;
  const loadPercent = loadAvg > 0 ? Math.min(100, (loadAvg / cpuCount) * 100) : cpu;

  const disk = process.platform === 'win32' ? await getDiskUsageWindows('C') : null;
  const network = await getNetworkRate();
  const primaryNetwork = getPrimaryNetwork();
  const serverName = os.hostname();
  const serverId = `local-${serverName}`;

  checkAnomaly('cpu', cpu, 85, serverId, serverName);
  checkAnomaly('memory', Number(memory.toFixed(2)), 85, serverId, serverName);
  if (disk?.percent != null) {
    checkAnomaly('disk', Number(disk.percent.toFixed(2)), 90, serverId, serverName);
  }
  checkAnomaly('load', Number(loadPercent.toFixed(2)), 90, serverId, serverName);

  return NextResponse.json({
    ok: true,
    timestamp: Date.now(),
    cpu,
    memory: Number(memory.toFixed(2)),
    load: Number(loadPercent.toFixed(2)),
    disk: disk ? disk.percent : null,
    uptime: os.uptime(),
    host: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cores: cpuCount,
    ipAddress: primaryNetwork.ip,
    netmask: primaryNetwork.netmask,
    interface: primaryNetwork.name,
    diskDetail: disk,
    network,
  });
}
