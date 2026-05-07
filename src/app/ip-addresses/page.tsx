'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { IPAddress, IPAddressStatus, Subnet } from '@/types';
import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Edit2,
  History,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Trash2,
  User,
  Wifi,
  X,
} from 'lucide-react';

// ─── IP utility helpers ────────────────────────────────────────────────────────

const ipToInt = (ip: unknown): number | null => {
  if (typeof ip !== 'string') return null;
  const normalized = ip.trim();
  if (!normalized) return null;
  const parts = normalized.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((p) => Number(p));
  if (numbers.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((numbers[0] << 24) + (numbers[1] << 16) + (numbers[2] << 8) + numbers[3]) >>> 0;
};

const intToIp = (v: number) =>
  [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');

const maskFromPrefix = (prefix: number) =>
  prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

const prefixFromMask = (mask: string): number | null => {
  const m = ipToInt(mask);
  if (m === null) return null;
  const bin = m.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bin)) return null;
  return (bin.match(/1/g) || []).length;
};

const parseCidr = (cidr: string) => {
  const [ip, prefixStr] = cidr.split('/');
  if (!ip || prefixStr === undefined) return null;
  const prefix = Number(prefixStr);
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return null;
  const ipInt = ipToInt(ip);
  if (ipInt === null) return null;
  return { ipInt, prefix };
};

const getTotalIps = (prefix: number) => 2 ** (32 - prefix);
const getUsableHosts = (prefix: number) => {
  const t = getTotalIps(prefix);
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  return Math.max(t - 2, 0);
};
const calculatePrefixForHosts = (hostCount: number): number | null => {
  for (let p = 32; p >= 0; p--) {
    if (getUsableHosts(p) >= hostCount) return p;
  }
  return null;
};
const calculatePrefixForSubnets = (mainPrefix: number, subnetCount: number) => {
  const bits = Math.ceil(Math.log2(subnetCount));
  const prefix = mainPrefix + bits;
  if (prefix > 32) return null;
  return { prefix, actualSubnets: 2 ** bits };
};

type SubnetPlan = {
  valid: boolean; error?: string; subnetCidr?: string; networkAddress?: string;
  broadcastAddress?: string; firstIp?: string; lastIp?: string; netmask?: string;
  wildcard?: string; usableHosts?: number; totalIps?: number; prefix?: number;
  networkInt?: number; broadcastInt?: number; totalSubnets?: number; subnetIndex?: number;
  actualSubnets?: number;
};

const buildNetworkDetails = (networkInt: number, prefix: number): SubnetPlan => {
  const mask = maskFromPrefix(prefix);
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0;
  const first = prefix >= 31 ? networkInt : networkInt + 1;
  const last = prefix >= 31 ? broadcastInt : broadcastInt - 1;
  return {
    valid: true, subnetCidr: `${intToIp(networkInt)}/${prefix}`,
    networkAddress: intToIp(networkInt), broadcastAddress: intToIp(broadcastInt),
    firstIp: intToIp(first >>> 0), lastIp: intToIp(last >>> 0),
    netmask: intToIp(mask), wildcard: intToIp((~mask) >>> 0),
    usableHosts: getUsableHosts(prefix), totalIps: getTotalIps(prefix), prefix, networkInt, broadcastInt,
  };
};

const hasOverlap = (start: number, end: number, existing: Subnet[]) =>
  existing.some((s) => {
    const a = ipToInt(s.rangeStart); const b = ipToInt(s.rangeEnd);
    if (a === null || b === null) return false;
    return !(end < a || start > b);
  });

const computeSubnetPlan = (
  mainCidr: string, mode: 'hosts' | 'subnets', hostCount: number, subnetCount: number,
  idxMode: 'auto' | 'index', subnetIndex: number, existing: Subnet[],
): SubnetPlan => {
  if (!mainCidr) return { valid: false };
  const main = parseCidr(mainCidr);
  if (!main) return { valid: false, error: 'Réseau principal invalide (ex: 192.168.0.0/16)' };
  let prefix: number | null = null; let actualSubnets: number | undefined;
  if (mode === 'hosts') {
    prefix = calculatePrefixForHosts(hostCount);
    if (prefix === null) return { valid: false, error: "Nombre d'hôtes invalide" };
  } else {
    const r = calculatePrefixForSubnets(main.prefix, subnetCount);
    if (!r) return { valid: false, error: 'Nombre de sous-réseaux invalide' };
    prefix = r.prefix; actualSubnets = r.actualSubnets;
  }
  if (prefix < main.prefix) return { valid: false, error: 'Le réseau principal est trop petit' };
  const mainMask = maskFromPrefix(main.prefix);
  const mainNetwork = main.ipInt & mainMask;
  const mainBroadcast = (mainNetwork | (~mainMask >>> 0)) >>> 0;
  const subnetSize = 2 ** (32 - prefix);
  const totalSubnets = 2 ** (prefix - main.prefix);
  let chosenIndex: number | null = null;
  if (idxMode === 'index') {
    const req = Math.floor(subnetIndex) - 1;
    if (!Number.isFinite(req) || req < 0 || req >= totalSubnets) return { valid: false, error: `Index invalide (1 → ${totalSubnets})` };
    chosenIndex = req;
  } else {
    for (let i = 0; i < totalSubnets; i++) {
      const s = (mainNetwork + i * subnetSize) >>> 0;
      const e = (s + subnetSize - 1) >>> 0;
      if (e > mainBroadcast) continue;
      if (!hasOverlap(s, e, existing)) { chosenIndex = i; break; }
    }
  }
  if (chosenIndex === null) return { valid: false, error: 'Aucun sous-réseau disponible' };
  const networkInt = (mainNetwork + chosenIndex * subnetSize) >>> 0;
  return { ...buildNetworkDetails(networkInt, prefix), totalSubnets, subnetIndex: chosenIndex + 1, actualSubnets };
};

const isIpInRange = (ip: string, start: string, end: string) => {
  const i = ipToInt(ip); const s = ipToInt(start); const e = ipToInt(end);
  if (i === null || s === null || e === null) return false;
  return i >= s && i <= e;
};

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<IPAddressStatus, string> = {
  free: 'Libre',
  assigned: 'Assignée',
  reserved: 'Réservée',
  conflict: 'Conflit',
};

const STATUS_CLASSES: Record<IPAddressStatus, string> = {
  free: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  reserved: 'bg-amber-100 text-amber-700 border-amber-200',
  conflict: 'bg-rose-100 text-rose-700 border-rose-200',
};

// ─── Local types ───────────────────────────────────────────────────────────────

type IPForm = {
  address: string;
  status: IPAddressStatus;
  subnet: string;
  linkedMachine: string;
  linkedUser: string;
  linkedService: string;
  comment: string;
};

type SubnetForm = {
  name: string; mainNetworkCidr: string; calculationMode: 'hosts' | 'subnets';
  hostCount: number; subnetCount: number; subnetIndexMode: 'auto' | 'index';
  subnetIndex: number; allocation: string;
};

type PingResponse = {
  ok: boolean; target: string; elapsedMs?: number; sent?: number; received?: number;
  avgLatencyMs?: number | null; reachable?: boolean; error?: string;
};
type PingHistoryItem = {
  id: string; target: string; reachable: boolean; avgLatencyMs: number | null;
  sent: number; received: number; testedAt: string;
};

type ActiveTab = 'ipam' | 'subnets' | 'tools' | 'scanner';

type ScanResult = { ip: string; reachable: boolean; hostname?: string; latencyMs?: number; mac?: string; resolving?: boolean; };
type ScanProgress = { scanned: number; total: number };
type ScanDone = { total: number; reachable: number; elapsed: number };

type LocalIPEntry = {
  address: string;
  mac?: string;
  type: 'local' | 'arp-dynamic' | 'arp-static';
  iface?: string;
};

// ─── Validation ────────────────────────────────────────────────────────────────

const validateIpAddress = (address: string): boolean => {
  const parts = address.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && p.trim() !== '';
  });
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function IPAddressesPage() {
  const {
    subnets: storeSubnets,
    ipAddresses: storeIpAddresses,
    ipHistory,
    addIPAddress,
    updateIPAddress,
    deleteIPAddress,
    addSubnet,
    updateSubnet,
    deleteSubnet,
  } = useDashboardStore();

  const subnets = Array.isArray(storeSubnets) ? storeSubnets : [];
  const ipAddresses = Array.isArray(storeIpAddresses) ? storeIpAddresses : [];
  const history = Array.isArray(ipHistory) ? ipHistory : [];

  // ─── Tab ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('ipam');

  // ─── IPAM state ──────────────────────────────────────────────────────────────
  const [showIPModal, setShowIPModal] = useState(false);
  const [editingIPId, setEditingIPId] = useState<string | null>(null);
  const [ipFormError, setIpFormError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyIPId, setHistoryIPId] = useState<string | null>(null);

  // ─── Local IP discovery ───────────────────────────────────────────────────────
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverEntries, setDiscoverEntries] = useState<LocalIPEntry[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedDiscover, setSelectedDiscover] = useState<Set<string>>(new Set());

  const runDiscover = async () => {
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const res = await fetch('/api/system/local-ips', { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error('Réponse invalide');
      const entries: LocalIPEntry[] = data.entries ?? [];
      // Pre-select entries not already in the store
      const existing = new Set(ipAddresses.map((ip) => ip.address));
      setDiscoverEntries(entries);
      setSelectedDiscover(new Set(entries.filter((e) => !existing.has(e.address)).map((e) => e.address)));
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setDiscoverLoading(false);
    }
  };

  const importSelected = () => {
    const existing = new Set(ipAddresses.map((ip) => ip.address));
    const now = new Date();
    discoverEntries
      .filter((e) => selectedDiscover.has(e.address) && !existing.has(e.address))
      .forEach((e) => {
        addIPAddress({
          id: `ip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          address: e.address,
          status: e.type === 'local' ? 'reserved' : 'free',
          subnet: '',
          linkedMachine: e.iface ? `iface:${e.iface}` : undefined,
          comment: e.mac ? `MAC: ${e.mac} (${e.type})` : `Découvert via ARP (${e.type})`,
          updatedAt: now,
          createdAt: now,
        });
      });
    setShowDiscoverModal(false);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<IPAddressStatus | 'all'>('all');
  const [filterSubnet, setFilterSubnet] = useState<string>('all');
  const [sortField, setSortField] = useState<'address' | 'status' | 'subnet' | 'updatedAt'>('address');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [ipForm, setIpForm] = useState<IPForm>({
    address: '', status: 'free', subnet: '',
    linkedMachine: '', linkedUser: '', linkedService: '', comment: '',
  });

  // ─── Subnet state ────────────────────────────────────────────────────────────
  const [showSubnetModal, setShowSubnetModal] = useState(false);
  const [editingSubnetId, setEditingSubnetId] = useState<string | null>(null);
  const [subnetFormError, setSubnetFormError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [subnetForm, setSubnetForm] = useState<SubnetForm>({
    name: '', mainNetworkCidr: '', calculationMode: 'hosts',
    hostCount: 50, subnetCount: 4, subnetIndexMode: 'auto', subnetIndex: 1, allocation: '',
  });

  // ─── Tools state ─────────────────────────────────────────────────────────────
  const [pingTarget, setPingTarget] = useState('');
  const [pingLoading, setPingLoading] = useState(false);
  const [pingLive, setPingLive] = useState(false);
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);
  const [pingHistory, setPingHistory] = useState<PingHistoryItem[]>([]);

  const [calcMode, setCalcMode] = useState<'cidr' | 'mask' | 'hosts' | 'subnets'>('cidr');
  const [calcCidr, setCalcCidr] = useState('192.168.10.0/24');
  const [calcIp, setCalcIp] = useState('192.168.10.0');
  const [calcMask, setCalcMask] = useState('255.255.255.0');
  const [calcMainCidr, setCalcMainCidr] = useState('192.168.0.0/16');
  const [calcHosts, setCalcHosts] = useState(120);
  const [calcSubnets, setCalcSubnets] = useState(8);
  const [calcSubnetIndexMode, setCalcSubnetIndexMode] = useState<'auto' | 'index'>('auto');
  const [calcSubnetIndex, setCalcSubnetIndex] = useState(1);

  // ─── Scanner state ────────────────────────────────────────────────────────────
  const [scanRange, setScanRange] = useState('192.168.1.1-254');
  const [scanRunning, setScanRunning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanDone, setScanDone] = useState<ScanDone | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanFilter, setScanFilter] = useState<'all' | 'online'>('all');
  const [selectedScan, setSelectedScan] = useState<Set<string>>(new Set());
  const scanSourceRef = useRef<EventSource | null>(null);

  const startScan = () => {
    scanSourceRef.current?.close();
    setScanResults([]);
    setScanProgress(null);
    setScanDone(null);
    setScanError(null);
    setScanRunning(true);
    setSelectedScan(new Set());

    const src = new EventSource(`/api/system/ip-scan?range=${encodeURIComponent(scanRange)}`);
    scanSourceRef.current = src;

    src.addEventListener('start', (e) => {
      const d = JSON.parse(e.data);
      setScanProgress({ scanned: 0, total: d.total });
    });
    src.addEventListener('result', (e) => {
      const r: ScanResult = JSON.parse(e.data);
      setScanResults((prev) => [...prev, r]);
    });
    src.addEventListener('update', (e) => {
      const d = JSON.parse(e.data);
      setScanResults((prev) =>
        prev.map((r) =>
          r.ip === d.ip
            ? { ...r, hostname: d.hostname ?? r.hostname, mac: d.mac ?? r.mac, resolving: false }
            : r
        )
      );
    });
    src.addEventListener('progress', (e) => {
      setScanProgress(JSON.parse(e.data));
    });
    src.addEventListener('done', (e) => {
      setScanDone(JSON.parse(e.data));
      setScanRunning(false);
      src.close();
    });
    src.addEventListener('error', (e) => {
      // @ts-ignore
      setScanError(e.data ? JSON.parse(e.data).message : 'Erreur de scan');
      setScanRunning(false);
      src.close();
    });
    src.onerror = () => {
      setScanRunning(false);
      src.close();
    };
  };

  const stopScan = () => {
    scanSourceRef.current?.close();
    setScanRunning(false);
  };

  const importScanSelected = () => {
    const existing = new Set(ipAddresses.map((ip) => ip.address));
    const now = new Date();
    scanResults
      .filter((r) => r.reachable && selectedScan.has(r.ip) && !existing.has(r.ip))
      .forEach((r) => {
        addIPAddress({
          id: `ip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          address: r.ip,
          status: 'assigned',
          subnet: '',
          linkedMachine: r.hostname ?? undefined,
          comment: [
            r.mac ? `MAC: ${r.mac}` : '',
            r.hostname ? `Host: ${r.hostname}` : '',
            r.latencyMs !== undefined ? `Latence: ${r.latencyMs}ms` : '',
          ].filter(Boolean).join(' | '),
          updatedAt: now,
          createdAt: now,
        });
      });
    setSelectedScan(new Set());
    setActiveTab('ipam');
  };

  // Cleanup EventSource on unmount
  useEffect(() => { return () => { scanSourceRef.current?.close(); }; }, []);

  // ─── IPAM computed ────────────────────────────────────────────────────────────

  const conflictAddresses = useMemo(() => {
    const seen = new Map<string, number>();
    ipAddresses.forEach((ip) => seen.set(ip.address, (seen.get(ip.address) ?? 0) + 1));
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([a]) => a));
  }, [ipAddresses]);

  const ipStats = useMemo(() => {
    const byStatus = { free: 0, assigned: 0, reserved: 0, conflict: 0 };
    ipAddresses.forEach((ip) => {
      const s: IPAddressStatus = conflictAddresses.has(ip.address) ? 'conflict' : ip.status;
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    });
    return { total: ipAddresses.length, ...byStatus };
  }, [ipAddresses, conflictAddresses]);

  const saturationAlerts = useMemo(() =>
    subnets.map((subnet) => {
      const used = ipAddresses.filter((ip) => ip.address && isIpInRange(ip.address, subnet.rangeStart, subnet.rangeEnd)).length;
      const occupancy = subnet.usableHosts > 0 ? (used / subnet.usableHosts) * 100 : 0;
      return { subnet, used, occupancy };
    }).filter((s) => s.occupancy >= 80),
    [subnets, ipAddresses],
  );

  const usedSubnets = useMemo(() => {
    const set = new Set(ipAddresses.map((ip) => ip.subnet).filter(Boolean));
    return Array.from(set).sort();
  }, [ipAddresses]);

  const filteredIPs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return ipAddresses
      .filter((ip) => {
        if (filterStatus !== 'all' && ip.status !== filterStatus) return false;
        if (filterSubnet !== 'all' && ip.subnet !== filterSubnet) return false;
        if (q) {
          return (
            ip.address.toLowerCase().includes(q) ||
            (ip.linkedMachine ?? '').toLowerCase().includes(q) ||
            (ip.linkedUser ?? '').toLowerCase().includes(q) ||
            (ip.linkedService ?? '').toLowerCase().includes(q) ||
            (ip.comment ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'address') cmp = (ipToInt(a.address) ?? 0) - (ipToInt(b.address) ?? 0);
        else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
        else if (sortField === 'subnet') cmp = (a.subnet ?? '').localeCompare(b.subnet ?? '');
        else if (sortField === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [ipAddresses, searchQuery, filterStatus, filterSubnet, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const filteredHistory = useMemo(() => {
    if (!historyIPId) return history.slice(0, 50);
    return history.filter((h) => h.ipAddressId === historyIPId);
  }, [history, historyIPId]);

  // ─── Subnet computed ──────────────────────────────────────────────────────────

  const subnetFormPlan = useMemo(
    () => computeSubnetPlan(
      subnetForm.mainNetworkCidr, subnetForm.calculationMode,
      subnetForm.hostCount, subnetForm.subnetCount,
      subnetForm.subnetIndexMode, subnetForm.subnetIndex,
      subnets.filter((s) => s.id !== editingSubnetId),
    ),
    [subnetForm, subnets, editingSubnetId],
  );

  const subnetMetrics = useMemo(() =>
    subnets.map((subnet) => {
      const used = ipAddresses.filter((ip) => ip?.address && isIpInRange(ip.address, subnet.rangeStart, subnet.rangeEnd)).length;
      const totalIps = getTotalIps(subnet.prefix);
      const free = Math.max(subnet.usableHosts - used, 0);
      const occupancy = subnet.usableHosts > 0 ? Math.min((used / subnet.usableHosts) * 100, 100) : 0;
      const conflicts = subnets.filter((other) => other.id !== subnet.id).filter((other) => {
        const aS = ipToInt(subnet.rangeStart); const aE = ipToInt(subnet.rangeEnd);
        const bS = ipToInt(other.rangeStart); const bE = ipToInt(other.rangeEnd);
        if (aS === null || aE === null || bS === null || bE === null) return false;
        return !(aE < bS || aS > bE);
      }).map((c) => c.name);
      return { subnet, used, free, totalIps, occupancy, conflicts };
    }),
    [subnets, ipAddresses],
  );

  const subnetTotals = useMemo(() => {
    const totalSubnets = subnetMetrics.length;
    const totalIps = subnetMetrics.reduce((s, i) => s + i.totalIps, 0);
    const totalUsable = subnetMetrics.reduce((s, i) => s + i.subnet.usableHosts, 0);
    const totalUsed = subnetMetrics.reduce((s, i) => s + i.used, 0);
    const totalFree = Math.max(totalUsable - totalUsed, 0);
    const conflicts = subnetMetrics.reduce((s, i) => s + (i.conflicts.length > 0 ? 1 : 0), 0);
    const avgOccupancy = totalUsable > 0 ? (totalUsed / totalUsable) * 100 : 0;
    return { totalSubnets, totalIps, totalUsable, totalUsed, totalFree, conflicts, avgOccupancy };
  }, [subnetMetrics]);

  // ─── Calculator ───────────────────────────────────────────────────────────────

  const calculatorResult = useMemo((): SubnetPlan => {
    if (calcMode === 'cidr') {
      const parsed = parseCidr(calcCidr);
      if (!parsed) return { valid: false, error: 'CIDR invalide.' };
      const mask = maskFromPrefix(parsed.prefix);
      return buildNetworkDetails((parsed.ipInt & mask) >>> 0, parsed.prefix);
    }
    if (calcMode === 'mask') {
      const ipInt = ipToInt(calcIp); const prefix = prefixFromMask(calcMask);
      if (ipInt === null || prefix === null) return { valid: false, error: 'IP ou masque invalide.' };
      return buildNetworkDetails((ipInt & maskFromPrefix(prefix)) >>> 0, prefix);
    }
    if (calcMode === 'hosts')
      return computeSubnetPlan(calcMainCidr, 'hosts', calcHosts, 0, calcSubnetIndexMode, calcSubnetIndex, []);
    return computeSubnetPlan(calcMainCidr, 'subnets', 0, calcSubnets, calcSubnetIndexMode, calcSubnetIndex, []);
  }, [calcMode, calcCidr, calcIp, calcMask, calcMainCidr, calcHosts, calcSubnets, calcSubnetIndexMode, calcSubnetIndex]);

  const binaryView = useMemo(() => {
    if (!calculatorResult.valid || !calculatorResult.networkAddress || !calculatorResult.netmask) return null;
    const toBin = (ip: string) => ip.split('.').map((o) => Number(o).toString(2).padStart(8, '0')).join('.');
    return { network: toBin(calculatorResult.networkAddress), mask: toBin(calculatorResult.netmask) };
  }, [calculatorResult]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const resetIPForm = () => {
    setEditingIPId(null); setIpFormError(null);
    setIpForm({ address: '', status: 'free', subnet: '', linkedMachine: '', linkedUser: '', linkedService: '', comment: '' });
  };

  const handleIPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIpAddress(ipForm.address)) { setIpFormError('Adresse IP invalide (ex: 192.168.1.10)'); return; }
    if (!ipForm.subnet.trim()) { setIpFormError('Le subnet est requis'); return; }
    const now = new Date();
    const payload = {
      address: ipForm.address.trim(), status: ipForm.status,
      subnet: ipForm.subnet.trim(),
      linkedMachine: ipForm.linkedMachine.trim() || undefined,
      linkedUser: ipForm.linkedUser.trim() || undefined,
      linkedService: ipForm.linkedService.trim() || undefined,
      comment: ipForm.comment.trim() || undefined,
      updatedAt: now,
    };
    if (editingIPId) {
      updateIPAddress(editingIPId, payload);
    } else {
      addIPAddress({ id: `ip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: now, ...payload });
    }
    setShowIPModal(false); resetIPForm();
  };

  const handleEditIP = (ip: IPAddress) => {
    setEditingIPId(ip.id);
    setIpForm({ address: ip.address, status: ip.status, subnet: ip.subnet ?? '', linkedMachine: ip.linkedMachine ?? '', linkedUser: ip.linkedUser ?? '', linkedService: ip.linkedService ?? '', comment: ip.comment ?? '' });
    setIpFormError(null); setShowIPModal(true);
  };

  const resetSubnetForm = () => {
    setEditingSubnetId(null); setSubnetFormError(null);
    setSubnetForm({ name: '', mainNetworkCidr: '', calculationMode: 'hosts', hostCount: 50, subnetCount: 4, subnetIndexMode: 'auto', subnetIndex: 1, allocation: '' });
  };

  const handleSubnetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subnetFormPlan.valid) { setSubnetFormError(subnetFormPlan.error || 'Données invalides'); return; }
    const payload = {
      name: subnetForm.name.trim() || `Sous-réseau ${subnetFormPlan.subnetCidr}`,
      mainNetworkCidr: subnetForm.mainNetworkCidr.trim(),
      subnetCidr: subnetFormPlan.subnetCidr as string,
      networkAddress: subnetFormPlan.networkAddress as string,
      prefix: subnetFormPlan.prefix as number,
      netmask: subnetFormPlan.netmask as string,
      rangeStart: subnetFormPlan.firstIp as string,
      rangeEnd: subnetFormPlan.lastIp as string,
      usableHosts: subnetFormPlan.usableHosts as number,
      allocation: subnetForm.allocation.trim(),
      updatedAt: new Date(),
    };
    if (editingSubnetId) { updateSubnet(editingSubnetId, payload); }
    else { addSubnet({ id: Date.now().toString(), createdAt: new Date(), ...payload }); }
    setShowSubnetModal(false); resetSubnetForm();
  };

  const runPingTest = async () => {
    if (!pingTarget.trim()) { setPingResult({ ok: false, target: '', error: 'Saisissez une IP ou un hostname.' }); return; }
    setPingLoading(true);
    try {
      const t = encodeURIComponent(pingTarget.trim());
      const res = await fetch(`/api/system/ping?target=${t}&count=4`, { cache: 'no-store' });
      const data = await res.json();
      setPingResult(data);
      if (data?.target) {
        const item: PingHistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          target: data.target, reachable: Boolean(data.reachable),
          avgLatencyMs: data.avgLatencyMs == null ? null : Number(data.avgLatencyMs),
          sent: Number(data.sent ?? 0), received: Number(data.received ?? 0),
          testedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        setPingHistory((prev) => [item, ...prev].slice(0, 3));
      }
    } catch { setPingResult({ ok: false, target: pingTarget.trim(), error: 'Erreur réseau pendant le test ICMP.' }); }
    finally { setPingLoading(false); }
  };

  useEffect(() => {
    if (!pingLive || !pingTarget.trim()) return;
    void runPingTest();
    const t = setInterval(() => void runPingTest(), 5000);
    return () => clearInterval(t);
  }, [pingLive, pingTarget]);

  const copyValue = async (key: string, value?: string | number) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(String(value)); setCopiedField(key); setTimeout(() => setCopiedField(null), 1200); }
    catch { setCopiedField(null); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)
      : null;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Gestion IPAM
            </h1>
            <p className="text-slate-600 mt-1">
              Inventaire des adresses IP, sous-réseaux, tests ICMP et calculateur réseau.
            </p>
          </div>
          {activeTab === 'ipam' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setDiscoverEntries([]); setDiscoverError(null); setShowDiscoverModal(true); runDiscover(); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50"
              >
                <Download size={18} /> Découvrir
              </button>
              <button
                onClick={() => { resetIPForm(); setShowIPModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-md hover:shadow-lg"
              >
                <Plus size={18} /> Adresse IP
              </button>
            </div>
          )}
          {activeTab === 'subnets' && (
            <button
              onClick={() => { resetSubnetForm(); setShowSubnetModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-md hover:shadow-lg"
            >
              <Plus size={18} /> Sous-réseau
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {([
            { key: 'ipam', label: 'Adresses IP', icon: <Network size={15} /> },
            { key: 'subnets', label: 'Sous-réseaux', icon: <Wifi size={15} /> },
            { key: 'tools', label: 'Tests & Calcul', icon: <Calculator size={15} /> },
            { key: 'scanner', label: 'Scanner réseau', icon: <Radio size={15} /> },
          ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ TAB: IPAM ═══════════════ */}
        {activeTab === 'ipam' && (
          <div className="space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Total IP</p>
                <p className="text-2xl font-bold text-slate-900">{ipStats.total}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-600">Libres</p>
                <p className="text-2xl font-bold text-emerald-700">{ipStats.free}</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs text-blue-600">Assignées</p>
                <p className="text-2xl font-bold text-blue-700">{ipStats.assigned}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-600">Réservées</p>
                <p className="text-2xl font-bold text-amber-700">{ipStats.reserved}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs text-rose-600">Conflits</p>
                <p className="text-2xl font-bold text-rose-700">{ipStats.conflict + conflictAddresses.size}</p>
              </div>
            </div>

            {/* Alerts */}
            {(saturationAlerts.length > 0 || conflictAddresses.size > 0) && (
              <div className="space-y-2">
                {saturationAlerts.map((a) => (
                  <div key={a.subnet.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                    <span>
                      <strong>{a.subnet.name}</strong> ({a.subnet.subnetCidr}) — saturation à{' '}
                      <strong>{Math.round(a.occupancy)}%</strong> ({a.used} / {a.subnet.usableHosts} hôtes)
                    </span>
                  </div>
                ))}
                {conflictAddresses.size > 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                    <span>
                      <strong>{conflictAddresses.size} adresse(s) en conflit</strong> : {[...conflictAddresses].join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par IP, machine, utilisateur, service…"
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as IPAddressStatus | 'all')}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">Tous les statuts</option>
                <option value="free">Libre</option>
                <option value="assigned">Assignée</option>
                <option value="reserved">Réservée</option>
                <option value="conflict">Conflit</option>
              </select>
              <select
                value={filterSubnet}
                onChange={(e) => setFilterSubnet(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">Tous les subnets</option>
                {usedSubnets.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={() => { setHistoryIPId(null); setShowHistory((v) => !v); }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${showHistory ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <History size={15} /> Historique
                {history.length > 0 && (
                  <span className="rounded-full bg-indigo-100 text-indigo-700 text-xs px-1.5">{history.length}</span>
                )}
              </button>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort('address')}>
                        Adresse IP <SortIcon field="address" />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort('status')}>
                        Statut <SortIcon field="status" />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort('subnet')}>
                        Subnet <SortIcon field="subnet" />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Machine</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Utilisateur</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Service</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Commentaire</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort('updatedAt')}>
                        Modifié <SortIcon field="updatedAt" />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Auteur</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIPs.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-slate-400">
                          {ipAddresses.length === 0
                            ? 'Aucune adresse IP enregistrée. Cliquez sur « Adresse IP » pour commencer.'
                            : 'Aucune adresse ne correspond aux filtres.'}
                        </td>
                      </tr>
                    ) : filteredIPs.map((ip) => {
                      const isConflict = conflictAddresses.has(ip.address);
                      const displayStatus: IPAddressStatus = isConflict ? 'conflict' : ip.status;
                      return (
                        <tr key={ip.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-slate-900">{ip.address}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[displayStatus]}`}>
                              {isConflict && <AlertTriangle size={10} />}
                              {STATUS_LABELS[displayStatus]}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 text-xs">{ip.subnet || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{ip.linkedMachine || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {ip.linkedUser
                              ? <span className="inline-flex items-center gap-1"><User size={12} className="text-slate-400" />{ip.linkedUser}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{ip.linkedService || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate" title={ip.comment}>{ip.comment || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                            {new Date(ip.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{ip.updatedBy || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => { setHistoryIPId(ip.id); setShowHistory(true); }} title="Historique" className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                                <History size={13} />
                              </button>
                              <button onClick={() => handleEditIP(ip)} title="Modifier" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => deleteIPAddress(ip.id)} title="Supprimer" className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredIPs.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                  <span>{filteredIPs.length} adresse(s) affichée(s) sur {ipAddresses.length}</span>
                  {(searchQuery || filterStatus !== 'all' || filterSubnet !== 'all') && (
                    <button onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterSubnet('all'); }} className="text-blue-600 hover:underline">
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* History panel */}
            {showHistory && (
              <section className="rounded-2xl border border-indigo-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={17} className="text-indigo-600" />
                    <h2 className="text-base font-bold text-slate-900">
                      Historique des modifications
                      {historyIPId && (
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          — {ipAddresses.find((ip) => ip.id === historyIPId)?.address ?? historyIPId}
                        </span>
                      )}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {historyIPId && (
                      <button onClick={() => setHistoryIPId(null)} className="text-xs text-blue-600 hover:underline">
                        Tout afficher
                      </button>
                    )}
                    <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:bg-slate-100">
                      <X size={15} className="text-slate-500" />
                    </button>
                  </div>
                </div>
                {filteredHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">Aucun historique pour le moment.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredHistory.map((h) => (
                      <div key={h.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="mt-0.5 shrink-0">
                          {h.action === 'create' && <CheckCircle size={15} className="text-emerald-500" />}
                          {h.action === 'update' && <Edit2 size={15} className="text-blue-500" />}
                          {h.action === 'delete' && <Trash2 size={15} className="text-rose-500" />}
                        </div>
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold font-mono text-slate-800">{h.address}</span>
                            <span className="text-xs text-slate-400 shrink-0">
                              {new Date(h.changedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-0.5">
                            <span className={`text-xs font-medium ${h.action === 'create' ? 'text-emerald-600' : h.action === 'delete' ? 'text-rose-600' : 'text-blue-600'}`}>
                              {h.action === 'create' ? 'Création' : h.action === 'update' ? 'Modification' : 'Suppression'}
                            </span>
                            <span className="text-xs text-slate-500">par <strong>{h.changedBy}</strong></span>
                          </div>
                          {h.oldValue && <p className="mt-1 text-[11px] text-rose-600 truncate">Avant : <span className="font-mono">{h.oldValue}</span></p>}
                          {h.newValue && <p className="mt-0.5 text-[11px] text-emerald-700 truncate">Après : <span className="font-mono">{h.newValue}</span></p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: SUBNETS ═══════════════ */}
        {activeTab === 'subnets' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Sous-réseaux</p><p className="text-2xl font-bold text-slate-900">{subnetTotals.totalSubnets}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">IP totales</p><p className="text-2xl font-bold text-slate-900">{subnetTotals.totalIps}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">IP utilisées</p><p className="text-2xl font-bold text-blue-600">{subnetTotals.totalUsed}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">IP libres</p><p className="text-2xl font-bold text-emerald-600">{subnetTotals.totalFree}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Occupation moy.</p><p className="text-2xl font-bold text-amber-600">{Math.round(subnetTotals.avgOccupancy)}%</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Conflits</p><p className="text-2xl font-bold text-rose-600">{subnetTotals.conflicts}</p></div>
            </div>

            {saturationAlerts.length > 0 && (
              <div className="space-y-2">
                {saturationAlerts.map((a) => (
                  <div key={a.subnet.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                    <span><strong>{a.subnet.name}</strong> ({a.subnet.subnetCidr}) — saturation à <strong>{Math.round(a.occupancy)}%</strong> ({a.used} / {a.subnet.usableHosts} hôtes)</span>
                  </div>
                ))}
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4"><Network size={18} className="text-blue-600" /><h2 className="text-lg font-bold">Sous-réseaux configurés</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subnetMetrics.length === 0 ? (
                  <div className="md:col-span-2 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">Aucun subnet configuré.</div>
                ) : subnetMetrics.map((item) => (
                  <div key={item.subnet.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.subnet.name}</p>
                        <p className="text-xs text-slate-500">{item.subnet.subnetCidr} • {item.subnet.allocation}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const main = parseCidr(item.subnet.mainNetworkCidr);
                            const mainNetwork = main ? (main.ipInt & maskFromPrefix(main.prefix)) : null;
                            const subnetSize = 2 ** (32 - item.subnet.prefix);
                            const networkInt = ipToInt(item.subnet.networkAddress);
                            const index = mainNetwork !== null && networkInt !== null ? Math.floor((networkInt - mainNetwork) / subnetSize) + 1 : 1;
                            setEditingSubnetId(item.subnet.id);
                            setSubnetForm({ name: item.subnet.name, mainNetworkCidr: item.subnet.mainNetworkCidr, calculationMode: 'hosts', hostCount: item.subnet.usableHosts, subnetCount: 1, subnetIndexMode: 'index', subnetIndex: index, allocation: item.subnet.allocation });
                            setShowSubnetModal(true);
                          }}
                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteSubnet(item.subnet.id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <p>Masque: <span className="font-mono text-slate-700">{item.subnet.netmask}</span></p>
                      <p>Hôtes: <span className="font-semibold text-slate-700">{item.subnet.usableHosts}</span></p>
                      <p className="col-span-2">Plage: <span className="font-mono text-slate-700">{item.subnet.rangeStart} → {item.subnet.rangeEnd}</span></p>
                      <p>IP utilisées: <span className="font-semibold text-blue-700">{item.used}</span></p>
                      <p>IP libres: <span className="font-semibold text-emerald-700">{item.free}</span></p>
                      <p className="col-span-2">Taux: <span className={`font-semibold ${item.occupancy >= 80 ? 'text-amber-600' : 'text-slate-700'}`}>{Math.round(item.occupancy)}%</span></p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.occupancy >= 90 ? 'bg-rose-500' : item.occupancy >= 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}
                        style={{ width: `${item.occupancy}%` }}
                      />
                    </div>
                    <p className={`text-xs font-semibold ${item.conflicts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Conflits: {item.conflicts.length > 0 ? item.conflicts.join(', ') : 'Aucun'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════ TAB: TOOLS ═══════════════ */}
        {activeTab === 'tools' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Ping */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2"><Wifi size={18} className="text-emerald-600" /><h2 className="text-lg font-bold">Test ICMP temps réel</h2></div>
              <div>
                <label className="text-xs font-semibold text-slate-600">IP ou hostname</label>
                <input value={pingTarget} onChange={(e) => setPingTarget(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="192.168.1.10 ou srv-ad" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void runPingTest()} disabled={pingLoading} className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{pingLoading ? 'Test…' : 'Lancer test'}</button>
                <button onClick={() => setPingLive((v) => !v)} className={`rounded-lg px-3 py-2 text-xs font-semibold border ${pingLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                  <RefreshCw size={14} className={`inline mr-1 ${pingLive ? 'animate-spin' : ''}`} />Live
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <p>Statut: <span className={`font-semibold ${pingResult?.reachable ? 'text-emerald-700' : 'text-rose-700'}`}>{pingResult ? (pingResult.reachable ? 'Accessible' : 'Inaccessible') : '—'}</span></p>
                {pingResult?.reachable && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> En ligne
                  </span>
                )}
                <p>Temps de réponse: <span className="font-semibold">{pingResult?.elapsedMs != null ? `${pingResult.elapsedMs} ms` : '—'}</span></p>
                <p>Paquets: <span className="font-semibold">{pingResult?.sent ?? '—'} / {pingResult?.received ?? '—'}</span></p>
                <p>Latence moy.: <span className="font-semibold">{pingResult?.avgLatencyMs != null ? `${pingResult.avgLatencyMs} ms` : '—'}</span></p>
                {pingResult?.error && <p className="text-rose-600 font-semibold">{pingResult.error}</p>}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-700 mb-2">Historique (3 derniers)</p>
                {pingHistory.length === 0 ? <p className="text-slate-500">Aucun test.</p> : (
                  <div className="space-y-1.5">
                    {pingHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-slate-700 truncate">{item.target}</p>
                          <p className="text-[11px] text-slate-500">{item.testedAt}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${item.reachable ? 'text-emerald-700' : 'text-rose-700'}`}>{item.reachable ? 'En ligne' : 'Hors ligne'}</p>
                          <p className="text-[11px] text-slate-500">{item.received}/{item.sent} • {item.avgLatencyMs != null ? `${item.avgLatencyMs} ms` : '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Calculator */}
            <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2"><Calculator size={18} className="text-indigo-600" /><h2 className="text-lg font-bold">Calculateur subnet</h2></div>
              <div className="rounded-2xl bg-slate-100/70 border border-slate-200 p-4 space-y-4">
                <p className="text-xs font-bold tracking-wide uppercase text-slate-700">Méthode de calcul</p>
                <div className="flex flex-wrap gap-5 text-sm text-slate-700">
                  {(['cidr', 'mask', 'hosts', 'subnets'] as const).map((m) => (
                    <label key={m} className="inline-flex items-center gap-2">
                      <input type="radio" name="calcMode" checked={calcMode === m} onChange={() => setCalcMode(m)} />
                      {m === 'cidr' ? 'Par CIDR' : m === 'mask' ? 'Par masque décimal' : m === 'hosts' ? "Par nb d'hôtes" : 'Par nb de sous-réseaux'}
                    </label>
                  ))}
                </div>
                {calcMode === 'cidr' && (
                  <input value={calcCidr} onChange={(e) => setCalcCidr(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="192.168.10.0/24" />
                )}
                {calcMode === 'mask' && (
                  <div className="grid grid-cols-2 gap-3">
                    <input value={calcIp} onChange={(e) => setCalcIp(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Adresse IP" />
                    <input value={calcMask} onChange={(e) => setCalcMask(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="255.255.255.0" />
                  </div>
                )}
                {(calcMode === 'hosts' || calcMode === 'subnets') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={calcMainCidr} onChange={(e) => setCalcMainCidr(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="192.168.0.0/16" />
                      {calcMode === 'hosts'
                        ? <input type="number" min={1} value={calcHosts} onChange={(e) => setCalcHosts(Number(e.target.value))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Hôtes requis" />
                        : <input type="number" min={1} value={calcSubnets} onChange={(e) => setCalcSubnets(Number(e.target.value))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Nombre de sous-réseaux" />
                      }
                    </div>
                    <div className="flex flex-wrap gap-5 text-sm text-slate-700">
                      <label className="inline-flex items-center gap-2"><input type="radio" name="calcSubnet" checked={calcSubnetIndexMode === 'auto'} onChange={() => setCalcSubnetIndexMode('auto')} />Auto</label>
                      <label className="inline-flex items-center gap-2"><input type="radio" name="calcSubnet" checked={calcSubnetIndexMode === 'index'} onChange={() => setCalcSubnetIndexMode('index')} />Index précis</label>
                    </div>
                    {calcSubnetIndexMode === 'index' && (
                      <input type="number" min={1} value={calcSubnetIndex} onChange={(e) => setCalcSubnetIndex(Number(e.target.value))} className="max-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                    )}
                  </div>
                )}
              </div>

              {!calculatorResult.valid ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{calculatorResult.error || 'Entrées invalides.'}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                  {([
                    { label: 'Adresse réseau', value: calculatorResult.networkAddress },
                    { label: 'Broadcast', value: calculatorResult.broadcastAddress },
                    { label: 'Première IP', value: calculatorResult.firstIp },
                    { label: 'Dernière IP', value: calculatorResult.lastIp },
                    { label: 'Masque', value: calculatorResult.netmask },
                    { label: 'Wildcard', value: calculatorResult.wildcard },
                    { label: 'CIDR', value: calculatorResult.subnetCidr },
                    { label: 'Hôtes utilisables', value: calculatorResult.usableHosts != null ? String(calculatorResult.usableHosts) : undefined },
                  ] as Array<{ label: string; value: string | undefined }>).map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-mono text-slate-900 mt-1 break-all">{value || '—'}</p>
                      {value && (
                        <button onClick={() => void copyValue(label, value)} className="mt-2 text-xs inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                          <Copy size={12} /> {copiedField === label ? 'Copié' : 'Copier'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <p className="font-semibold text-slate-700">Conversion binaire</p>
                {binaryView ? (
                  <>
                    <p>Réseau: <span className="font-mono text-slate-800">{binaryView.network}</span></p>
                    <p>Masque: <span className="font-mono text-slate-800">{binaryView.mask}</span></p>
                  </>
                ) : <p className="text-slate-500">Résultat requis.</p>}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════ TAB: SCANNER ═══════════════ */}
        {activeTab === 'scanner' && (
          <div className="space-y-5">

            {/* Control panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Radio size={20} className="text-violet-500" />
                <h2 className="text-lg font-bold text-slate-800">Scanner réseau IP</h2>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Advanced IP Scanner</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Plage d'adresses IP</label>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      value={scanRange}
                      onChange={(e) => setScanRange(e.target.value)}
                      disabled={scanRunning}
                      placeholder="192.168.1.1-254 ou 192.168.1.0/24"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="flex gap-2 sm:flex-none">
                    {!scanRunning ? (
                      <button
                        onClick={startScan}
                        className="inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 shadow sm:w-auto"
                      >
                        <Radio size={16} /> Scanner
                      </button>
                    ) : (
                      <button
                        onClick={stopScan}
                        className="inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 sm:w-auto"
                      >
                        <X size={16} /> Arrêter
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-1.5 flex-wrap">
                  {['192.168.1.1-254', '192.168.0.1-254', '10.0.0.1-254', '172.16.0.1-254'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setScanRange(p)}
                      disabled={scanRunning}
                      className="text-xs text-violet-600 hover:underline disabled:opacity-40"
                    >{p}</button>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              {scanProgress && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{scanProgress.scanned} / {scanProgress.total} adresses</span>
                    <span>{Math.round((scanProgress.scanned / scanProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-200"
                      style={{ width: `${(scanProgress.scanned / scanProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Done summary */}
              {scanDone && (
                <div className="flex flex-wrap gap-5 text-sm pt-1">
                  <span className="text-slate-600">Scannées : <strong>{scanDone.total}</strong></span>
                  <span className="text-emerald-700">En ligne : <strong className="text-emerald-600">{scanDone.reachable}</strong></span>
                  <span className="text-slate-400">Hors ligne : <strong>{scanDone.total - scanDone.reachable}</strong></span>
                  <span className="text-slate-400">Durée : <strong>{(scanDone.elapsed / 1000).toFixed(1)}s</strong></span>
                </div>
              )}

              {/* Error */}
              {scanError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-sm">
                  <strong>Erreur :</strong> {scanError}
                </div>
              )}
            </div>

            {/* Results table */}
            {scanResults.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {scanResults.filter((r) => r.reachable).length} en ligne
                      {!scanRunning && ` / ${scanResults.length} scannées`}
                    </span>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                      <button
                        onClick={() => setScanFilter('all')}
                        className={`px-3 py-1.5 font-medium transition-colors ${scanFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                      >Toutes</button>
                      <button
                        onClick={() => setScanFilter('online')}
                        className={`px-3 py-1.5 font-medium transition-colors ${scanFilter === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                      >En ligne</button>
                    </div>
                    {scanFilter === 'online' && (
                      <button
                        className="text-xs text-violet-600 hover:underline"
                        onClick={() => {
                          const existing = new Set(ipAddresses.map((ip) => ip.address));
                          setSelectedScan(new Set(
                            scanResults.filter((r) => r.reachable && !existing.has(r.ip)).map((r) => r.ip)
                          ));
                        }}
                      >
                        Tout sélectionner (nouveaux)
                      </button>
                    )}
                  </div>

                  {selectedScan.size > 0 && (
                    <button
                      onClick={importScanSelected}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold shadow"
                    >
                      <Download size={15} /> Importer ({selectedScan.size})
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left">Adresse IP</th>
                        <th className="px-3 py-2 text-left">Hostname</th>
                        <th className="px-3 py-2 text-left">MAC</th>
                        <th className="px-3 py-2 text-left">Latence</th>
                        <th className="px-3 py-2 text-left">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...scanResults]
                        .filter((r) => scanFilter === 'all' || r.reachable)
                        .sort((a, b) => {
                          const ai = ipToInt(a.ip), bi = ipToInt(b.ip);
                          if (ai === null || bi === null) return 0;
                          return ai - bi;
                        })
                        .map((r) => {
                          const alreadyExists = ipAddresses.some((ip) => ip.address === r.ip);
                          const checked = selectedScan.has(r.ip);
                          return (
                            <tr
                              key={r.ip}
                              className={`transition-colors ${r.reachable ? 'hover:bg-violet-50/30' : 'opacity-40 bg-slate-50/50'}`}
                            >
                              <td className="px-3 py-2">
                                {r.reachable && (
                                  <input
                                    type="checkbox"
                                    disabled={alreadyExists}
                                    checked={checked}
                                    onChange={() => {
                                      const s = new Set(selectedScan);
                                      if (s.has(r.ip)) s.delete(r.ip); else s.add(r.ip);
                                      setSelectedScan(s);
                                    }}
                                    className="rounded border-slate-300 text-violet-600"
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono font-semibold text-slate-900">{r.ip}</td>
                              <td className="px-3 py-2 text-xs">
                                {r.resolving && !r.hostname
                                  ? <span className="inline-block w-20 h-3 bg-slate-200 rounded animate-pulse" />
                                  : <span className="text-slate-600">{r.hostname ?? '—'}</span>}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {r.resolving && !r.mac
                                  ? <span className="inline-block w-28 h-3 bg-slate-200 rounded animate-pulse" />
                                  : <span className="text-slate-500">{r.mac ?? '—'}</span>}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {r.reachable && r.latencyMs !== undefined ? (
                                  <span className={`font-mono ${r.latencyMs < 5 ? 'text-emerald-600' : r.latencyMs < 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {r.latencyMs}ms
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {r.reachable ? (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${alreadyExists ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {alreadyExists ? 'En ligne · importée' : 'En ligne'}
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Hors ligne</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Live indicator — show while scan is running but no results yet */}
            {scanRunning && scanResults.length === 0 && (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
                <Radio size={22} className="animate-pulse text-violet-400" />
                <span>Scan en cours…</span>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ MODAL: Découverte locale ═══════════════ */}
        {showDiscoverModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Download size={20} className="text-blue-500" /> Découvrir les IPs locales
                </h2>
                <button onClick={() => setShowDiscoverModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {discoverLoading && (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
                  <RefreshCw size={22} className="animate-spin text-blue-400" />
                  <span>Scan du réseau local en cours…</span>
                </div>
              )}

              {discoverError && !discoverLoading && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 mb-4">
                  {discoverError}
                </div>
              )}

              {!discoverLoading && discoverEntries.length === 0 && !discoverError && (
                <p className="text-slate-500 text-center py-8">Aucune entrée trouvée.</p>
              )}

              {!discoverLoading && discoverEntries.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-600">
                      {discoverEntries.length} adresse(s) trouvée(s) —{' '}
                      <span className="font-semibold text-blue-600">{selectedDiscover.size}</span> sélectionnée(s)
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setSelectedDiscover(new Set(discoverEntries.filter((e) => !ipAddresses.some((ip) => ip.address === e.address)).map((e) => e.address)))}
                      >
                        Tout sélectionner (nouveaux)
                      </button>
                      <button className="text-xs text-slate-400 hover:underline" onClick={() => setSelectedDiscover(new Set())}>
                        Tout désélectionner
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden mb-5">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-2 text-left w-8"></th>
                          <th className="px-3 py-2 text-left">Adresse IP</th>
                          <th className="px-3 py-2 text-left">MAC</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Iface</th>
                          <th className="px-3 py-2 text-left">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {discoverEntries.map((entry) => {
                          const alreadyExists = ipAddresses.some((ip) => ip.address === entry.address);
                          const checked = selectedDiscover.has(entry.address);
                          const typeLabel = entry.type === 'local' ? 'Machine locale' : entry.type === 'arp-static' ? 'ARP statique' : 'ARP dynamique';
                          const typeCls = entry.type === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
                          return (
                            <tr key={entry.address} className={alreadyExists ? 'bg-slate-50 opacity-60' : 'hover:bg-blue-50/40'}>
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  disabled={alreadyExists}
                                  checked={checked}
                                  onChange={() => {
                                    const s = new Set(selectedDiscover);
                                    if (s.has(entry.address)) s.delete(entry.address); else s.add(entry.address);
                                    setSelectedDiscover(s);
                                  }}
                                  className="rounded border-slate-300 text-blue-600"
                                />
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-800">{entry.address}</td>
                              <td className="px-3 py-2 font-mono text-slate-500 text-xs">{entry.mac ?? '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeCls}`}>{typeLabel}</span>
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{entry.iface ?? '—'}</td>
                              <td className="px-3 py-2 text-xs">
                                {alreadyExists
                                  ? <span className="text-emerald-600 font-medium">Déjà importée</span>
                                  : <span className="text-slate-400">Nouveau</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowDiscoverModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={importSelected}
                      disabled={selectedDiscover.size === 0}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow disabled:opacity-40"
                    >
                      Importer {selectedDiscover.size > 0 ? `(${selectedDiscover.size})` : ''}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ MODAL: Add/Edit IP ═══════════════ */}
        {showIPModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingIPId ? 'Modifier une adresse IP' : 'Ajouter une adresse IP'}
                </h3>
                <button onClick={() => { setShowIPModal(false); resetIPForm(); }} className="p-2 rounded-lg hover:bg-slate-100">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>

              {ipFormError && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{ipFormError}</div>
              )}

              <form onSubmit={handleIPSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Adresse IP *</label>
                    <input
                      value={ipForm.address}
                      onChange={(e) => setIpForm({ ...ipForm, address: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="192.168.1.10"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Statut *</label>
                    <select
                      value={ipForm.status}
                      onChange={(e) => setIpForm({ ...ipForm, status: e.target.value as IPAddressStatus })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="free">Libre</option>
                      <option value="assigned">Assignée</option>
                      <option value="reserved">Réservée</option>
                      <option value="conflict">Conflit</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Subnet (CIDR) *</label>
                  <input
                    value={ipForm.subnet}
                    onChange={(e) => setIpForm({ ...ipForm, subnet: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="192.168.1.0/24"
                    list="subnet-datalist"
                    required
                  />
                  <datalist id="subnet-datalist">
                    {subnets.map((s) => <option key={s.id} value={s.subnetCidr}>{s.name}</option>)}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Machine liée</label>
                    <input
                      value={ipForm.linkedMachine}
                      onChange={(e) => setIpForm({ ...ipForm, linkedMachine: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="SRV-DC01, PC-Alice…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Utilisateur lié</label>
                    <input
                      value={ipForm.linkedUser}
                      onChange={(e) => setIpForm({ ...ipForm, linkedUser: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="alice.dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Service / Département</label>
                    <input
                      value={ipForm.linkedService}
                      onChange={(e) => setIpForm({ ...ipForm, linkedService: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="DSI, RH, Réseau…"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Commentaire</label>
                  <textarea
                    value={ipForm.comment}
                    onChange={(e) => setIpForm({ ...ipForm, comment: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    placeholder="Note libre, contexte d'attribution…"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold hover:bg-blue-700">
                    {editingIPId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                  <button type="button" onClick={() => { setShowIPModal(false); resetIPForm(); }} className="flex-1 rounded-xl bg-slate-100 text-slate-700 py-2.5 text-sm font-semibold hover:bg-slate-200">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════ MODAL: Add/Edit Subnet ═══════════════ */}
        {showSubnetModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{editingSubnetId ? 'Modifier un sous-réseau' : 'Ajouter un sous-réseau'}</h3>
                <button onClick={() => { setShowSubnetModal(false); resetSubnetForm(); }} className="p-2 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
              </div>
              {subnetFormError && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{subnetFormError}</div>}
              <form onSubmit={handleSubnetSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={subnetForm.name} onChange={(e) => setSubnetForm({ ...subnetForm, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nom du subnet" />
                  <input value={subnetForm.mainNetworkCidr} onChange={(e) => setSubnetForm({ ...subnetForm, mainNetworkCidr: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Réseau principal CIDR" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select value={subnetForm.calculationMode} onChange={(e) => setSubnetForm({ ...subnetForm, calculationMode: e.target.value as 'hosts' | 'subnets' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="hosts">Par hôtes</option>
                    <option value="subnets">Par sous-réseaux</option>
                  </select>
                  {subnetForm.calculationMode === 'hosts'
                    ? <input type="number" min={1} value={subnetForm.hostCount} onChange={(e) => setSubnetForm({ ...subnetForm, hostCount: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nb hôtes" required />
                    : <input type="number" min={1} value={subnetForm.subnetCount} onChange={(e) => setSubnetForm({ ...subnetForm, subnetCount: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nb sous-réseaux" required />
                  }
                  <input value={subnetForm.allocation} onChange={(e) => setSubnetForm({ ...subnetForm, allocation: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Service / Département" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select value={subnetForm.subnetIndexMode} onChange={(e) => setSubnetForm({ ...subnetForm, subnetIndexMode: e.target.value as 'auto' | 'index' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="auto">Index auto</option>
                    <option value="index">Index précis</option>
                  </select>
                  {subnetForm.subnetIndexMode === 'index' && (
                    <input type="number" min={1} value={subnetForm.subnetIndex} onChange={(e) => setSubnetForm({ ...subnetForm, subnetIndex: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Index" required />
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  {subnetFormPlan.valid ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700">
                      <p>CIDR: <span className="font-mono">{subnetFormPlan.subnetCidr}</span></p>
                      <p>Masque: <span className="font-mono">{subnetFormPlan.netmask}</span></p>
                      <p>Adresse réseau: <span className="font-mono">{subnetFormPlan.networkAddress}</span></p>
                      <p>Broadcast: <span className="font-mono">{subnetFormPlan.broadcastAddress}</span></p>
                      <p>Première IP: <span className="font-mono">{subnetFormPlan.firstIp}</span></p>
                      <p>Dernière IP: <span className="font-mono">{subnetFormPlan.lastIp}</span></p>
                      <p>Hôtes utilisables: <span className="font-semibold">{subnetFormPlan.usableHosts}</span></p>
                      <p>Index: <span className="font-semibold">{subnetFormPlan.subnetIndex}</span></p>
                    </div>
                  ) : <p className="text-rose-600">{subnetFormPlan.error || 'Données insuffisantes'}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700">{editingSubnetId ? 'Mettre à jour' : 'Créer le sous-réseau'}</button>
                  <button type="button" onClick={() => { setShowSubnetModal(false); resetSubnetForm(); }} className="flex-1 rounded-lg bg-slate-100 text-slate-700 py-2 text-sm font-semibold hover:bg-slate-200">Annuler</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
