import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';

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

export async function GET() {
  const cpu = await getCpuUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memory = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;
  const loadAvg = os.loadavg?.()[0] ?? 0;
  const cpuCount = os.cpus().length || 1;
  const loadPercent = loadAvg > 0 ? Math.min(100, (loadAvg / cpuCount) * 100) : cpu;

  const disk = process.platform === 'win32' ? await getDiskUsageWindows('C') : null;

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
    diskDetail: disk,
    network: {
      incoming: 0,
      outgoing: 0,
    },
  });
}
