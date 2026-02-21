'use client';

import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Subnet } from '@/types';
import { Calculator, Copy, Edit2, Network, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react';

type SubnetForm = {
  name: string;
  mainNetworkCidr: string;
  calculationMode: 'hosts' | 'subnets';
  hostCount: number;
  subnetCount: number;
  subnetIndexMode: 'auto' | 'index';
  subnetIndex: number;
  allocation: string;
};

type SubnetPlan = {
  valid: boolean;
  error?: string;
  subnetCidr?: string;
  networkAddress?: string;
  broadcastAddress?: string;
  firstIp?: string;
  lastIp?: string;
  netmask?: string;
  wildcard?: string;
  usableHosts?: number;
  totalIps?: number;
  prefix?: number;
  networkInt?: number;
  broadcastInt?: number;
  totalSubnets?: number;
  subnetIndex?: number;
  actualSubnets?: number;
};

type PingResponse = {
  ok: boolean;
  target: string;
  elapsedMs?: number;
  sent?: number;
  received?: number;
  avgLatencyMs?: number | null;
  reachable?: boolean;
  error?: string;
  details?: string;
};

const ipToInt = (ip: unknown) => {
  if (typeof ip !== 'string') return null;
  const normalized = ip.trim();
  if (!normalized) return null;
  const parts = normalized.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((numbers[0] << 24) + (numbers[1] << 16) + (numbers[2] << 8) + numbers[3]) >>> 0;
};

const intToIp = (value: number) => {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
};

const maskFromPrefix = (prefix: number) => {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
};

const prefixFromMask = (mask: string) => {
  const maskInt = ipToInt(mask);
  if (maskInt === null) return null;
  const binary = maskInt.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(binary)) return null;
  return (binary.match(/1/g) || []).length;
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
  const total = getTotalIps(prefix);
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  return Math.max(total - 2, 0);
};

const calculatePrefixForHosts = (hostCount: number) => {
  const required = Math.floor(hostCount);
  if (!Number.isFinite(required) || required <= 0) return null;
  for (let prefix = 32; prefix >= 0; prefix -= 1) {
    if (getUsableHosts(prefix) >= required) return prefix;
  }
  return null;
};

const calculatePrefixForSubnets = (mainPrefix: number, subnetCount: number) => {
  const desired = Math.floor(subnetCount);
  if (!Number.isFinite(desired) || desired <= 0) return null;
  const extraBits = Math.ceil(Math.log2(desired));
  const prefix = mainPrefix + extraBits;
  if (prefix > 32) return null;
  return { prefix, actualSubnets: 2 ** extraBits };
};

const hasOverlap = (start: number, end: number, existingSubnets: Subnet[]) => {
  return existingSubnets.some((subnet) => {
    const s = ipToInt(subnet.rangeStart);
    const e = ipToInt(subnet.rangeEnd);
    if (s === null || e === null) return false;
    return !(end < s || start > e);
  });
};

const buildNetworkDetails = (networkInt: number, prefix: number): SubnetPlan => {
  const mask = maskFromPrefix(prefix);
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0;
  const first = prefix >= 31 ? networkInt : networkInt + 1;
  const last = prefix >= 31 ? broadcastInt : broadcastInt - 1;

  return {
    valid: true,
    subnetCidr: `${intToIp(networkInt)}/${prefix}`,
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstIp: intToIp(first >>> 0),
    lastIp: intToIp(last >>> 0),
    netmask: intToIp(mask),
    wildcard: intToIp((~mask) >>> 0),
    usableHosts: getUsableHosts(prefix),
    totalIps: getTotalIps(prefix),
    prefix,
    networkInt,
    broadcastInt,
  };
};

const computeSubnetPlan = (
  mainCidr: string,
  mode: 'hosts' | 'subnets',
  hostCount: number,
  subnetCount: number,
  subnetIndexMode: 'auto' | 'index',
  subnetIndex: number,
  existingSubnets: Subnet[],
): SubnetPlan => {
  if (!mainCidr) return { valid: false };

  const main = parseCidr(mainCidr);
  if (!main) return { valid: false, error: 'Réseau principal invalide (ex: 192.168.0.0/16)' };

  let prefix: number | null = null;
  let actualSubnets: number | undefined;

  if (mode === 'hosts') {
    prefix = calculatePrefixForHosts(hostCount);
    if (prefix === null) return { valid: false, error: 'Nombre d’hôtes invalide' };
  } else {
    const result = calculatePrefixForSubnets(main.prefix, subnetCount);
    if (!result) return { valid: false, error: 'Nombre de sous-réseaux invalide' };
    prefix = result.prefix;
    actualSubnets = result.actualSubnets;
  }

  if (prefix < main.prefix) {
    return { valid: false, error: 'Le réseau principal est trop petit pour ce plan' };
  }

  const mainMask = maskFromPrefix(main.prefix);
  const mainNetwork = main.ipInt & mainMask;
  const mainBroadcast = (mainNetwork | (~mainMask >>> 0)) >>> 0;
  const subnetSize = 2 ** (32 - prefix);
  const totalSubnets = 2 ** (prefix - main.prefix);

  let chosenIndex: number | null = null;
  if (subnetIndexMode === 'index') {
    const requested = Math.floor(subnetIndex) - 1;
    if (!Number.isFinite(requested) || requested < 0 || requested >= totalSubnets) {
      return { valid: false, error: `Index invalide (1 → ${totalSubnets})` };
    }
    chosenIndex = requested;
  } else {
    for (let idx = 0; idx < totalSubnets; idx += 1) {
      const start = (mainNetwork + idx * subnetSize) >>> 0;
      const end = (start + subnetSize - 1) >>> 0;
      if (end > mainBroadcast) continue;
      if (!hasOverlap(start, end, existingSubnets)) {
        chosenIndex = idx;
        break;
      }
    }
  }

  if (chosenIndex === null) return { valid: false, error: 'Aucun sous-réseau disponible' };

  const networkInt = (mainNetwork + chosenIndex * subnetSize) >>> 0;
  const details = buildNetworkDetails(networkInt, prefix);

  return {
    ...details,
    totalSubnets,
    subnetIndex: chosenIndex + 1,
    actualSubnets,
  };
};

const isIpInRange = (ip: string, start: string, end: string) => {
  const ipInt = ipToInt(ip);
  const startInt = ipToInt(start);
  const endInt = ipToInt(end);
  if (ipInt === null || startInt === null || endInt === null) return false;
  return ipInt >= startInt && ipInt <= endInt;
};

export default function IPAddressesPage() {
  const {
    subnets: storeSubnets,
    ipAddresses: storeIpAddresses,
    addSubnet,
    updateSubnet,
    deleteSubnet,
  } = useDashboardStore();

  const subnets = Array.isArray(storeSubnets) ? storeSubnets : [];
  const ipAddresses = Array.isArray(storeIpAddresses) ? storeIpAddresses : [];

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [pingTarget, setPingTarget] = useState('');
  const [pingLoading, setPingLoading] = useState(false);
  const [pingLive, setPingLive] = useState(false);
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);

  const [calcMode, setCalcMode] = useState<'cidr' | 'mask' | 'hosts' | 'subnets'>('cidr');
  const [calcCidr, setCalcCidr] = useState('192.168.10.0/24');
  const [calcIp, setCalcIp] = useState('192.168.10.0');
  const [calcMask, setCalcMask] = useState('255.255.255.0');
  const [calcMainCidr, setCalcMainCidr] = useState('192.168.0.0/16');
  const [calcHosts, setCalcHosts] = useState(120);
  const [calcSubnets, setCalcSubnets] = useState(8);

  const [formData, setFormData] = useState<SubnetForm>({
    name: '',
    mainNetworkCidr: '',
    calculationMode: 'hosts',
    hostCount: 50,
    subnetCount: 4,
    subnetIndexMode: 'auto',
    subnetIndex: 1,
    allocation: '',
  });

  const formPlan = useMemo(
    () => computeSubnetPlan(
      formData.mainNetworkCidr,
      formData.calculationMode,
      formData.hostCount,
      formData.subnetCount,
      formData.subnetIndexMode,
      formData.subnetIndex,
      subnets.filter((s) => s.id !== editingId),
    ),
    [formData, subnets, editingId],
  );

  const subnetMetrics = useMemo(() => {
    return subnets.map((subnet) => {
      const used = ipAddresses.filter((ip) =>
        ip?.address && isIpInRange(ip.address, subnet.rangeStart, subnet.rangeEnd),
      ).length;
      const totalIps = getTotalIps(subnet.prefix);
      const free = Math.max(subnet.usableHosts - used, 0);
      const occupancy = subnet.usableHosts > 0 ? Math.min((used / subnet.usableHosts) * 100, 100) : 0;
      const conflicts = subnets
        .filter((other) => other.id !== subnet.id)
        .filter((other) => {
          const aStart = ipToInt(subnet.rangeStart);
          const aEnd = ipToInt(subnet.rangeEnd);
          const bStart = ipToInt(other.rangeStart);
          const bEnd = ipToInt(other.rangeEnd);
          if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
          return !(aEnd < bStart || aStart > bEnd);
        })
        .map((c) => c.name);

      return {
        subnet,
        used,
        free,
        totalIps,
        occupancy,
        conflicts,
      };
    });
  }, [subnets, ipAddresses]);

  const totals = useMemo(() => {
    const totalSubnets = subnetMetrics.length;
    const totalIps = subnetMetrics.reduce((sum, item) => sum + item.totalIps, 0);
    const totalUsable = subnetMetrics.reduce((sum, item) => sum + item.subnet.usableHosts, 0);
    const totalUsed = subnetMetrics.reduce((sum, item) => sum + item.used, 0);
    const totalFree = Math.max(totalUsable - totalUsed, 0);
    const conflicts = subnetMetrics.reduce((sum, item) => sum + (item.conflicts.length > 0 ? 1 : 0), 0);
    const avgOccupancy = totalUsable > 0 ? (totalUsed / totalUsable) * 100 : 0;

    return {
      totalSubnets,
      totalIps,
      totalUsable,
      totalUsed,
      totalFree,
      conflicts,
      avgOccupancy,
    };
  }, [subnetMetrics]);

  const calculatorResult = useMemo((): SubnetPlan => {
    if (calcMode === 'cidr') {
      const parsed = parseCidr(calcCidr);
      if (!parsed) return { valid: false, error: 'CIDR invalide.' };
      const mask = maskFromPrefix(parsed.prefix);
      const network = (parsed.ipInt & mask) >>> 0;
      return buildNetworkDetails(network, parsed.prefix);
    }

    if (calcMode === 'mask') {
      const ipInt = ipToInt(calcIp);
      const prefix = prefixFromMask(calcMask);
      if (ipInt === null || prefix === null) return { valid: false, error: 'IP ou masque invalide.' };
      const network = (ipInt & maskFromPrefix(prefix)) >>> 0;
      return buildNetworkDetails(network, prefix);
    }

    if (calcMode === 'hosts') {
      return computeSubnetPlan(calcMainCidr, 'hosts', calcHosts, 0, 'index', 1, []);
    }

    return computeSubnetPlan(calcMainCidr, 'subnets', 0, calcSubnets, 'index', 1, []);
  }, [calcMode, calcCidr, calcIp, calcMask, calcMainCidr, calcHosts, calcSubnets]);

  const binaryView = useMemo(() => {
    if (!calculatorResult.valid || !calculatorResult.networkAddress || !calculatorResult.netmask) {
      return null;
    }

    const toBinary = (ip: string) => ip
      .split('.')
      .map((octet) => Number(octet).toString(2).padStart(8, '0'))
      .join('.');

    return {
      network: toBinary(calculatorResult.networkAddress),
      mask: toBinary(calculatorResult.netmask),
    };
  }, [calculatorResult]);

  const runPingTest = async () => {
    if (!pingTarget.trim()) {
      setPingResult({ ok: false, target: '', error: 'Saisissez une IP ou un hostname.' });
      return;
    }

    setPingLoading(true);
    try {
      const target = encodeURIComponent(pingTarget.trim());
      const res = await fetch(`/api/system/ping?target=${target}&count=4`, { cache: 'no-store' });
      const data = await res.json();
      setPingResult(data);
    } catch {
      setPingResult({ ok: false, target: pingTarget.trim(), error: 'Erreur réseau pendant le test ICMP.' });
    } finally {
      setPingLoading(false);
    }
  };

  useEffect(() => {
    if (!pingLive || !pingTarget.trim()) return;
    void runPingTest();
    const timer = setInterval(() => {
      void runPingTest();
    }, 5000);
    return () => clearInterval(timer);
  }, [pingLive, pingTarget]);

  const copyValue = async (key: string, value?: string | number) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1200);
    } catch {
      setCopiedField(null);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormError(null);
    setFormData({
      name: '',
      mainNetworkCidr: '',
      calculationMode: 'hosts',
      hostCount: 50,
      subnetCount: 4,
      subnetIndexMode: 'auto',
      subnetIndex: 1,
      allocation: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formPlan.valid) {
      setFormError(formPlan.error || 'Données invalides');
      return;
    }

    const payload = {
      name: formData.name.trim() || `Sous-réseau ${formPlan.subnetCidr}`,
      mainNetworkCidr: formData.mainNetworkCidr.trim(),
      subnetCidr: formPlan.subnetCidr as string,
      networkAddress: formPlan.networkAddress as string,
      prefix: formPlan.prefix as number,
      netmask: formPlan.netmask as string,
      rangeStart: formPlan.firstIp as string,
      rangeEnd: formPlan.lastIp as string,
      usableHosts: formPlan.usableHosts as number,
      allocation: formData.allocation.trim(),
      updatedAt: new Date(),
    };

    if (editingId) {
      updateSubnet(editingId, payload);
    } else {
      addSubnet({
        id: Date.now().toString(),
        createdAt: new Date(),
        ...payload,
      });
    }

    setShowModal(false);
    resetForm();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">Gestion des sous-réseaux</h1>
            <p className="text-slate-600 mt-2">Visualisation, test ICMP en temps réel et calculateur de subnet interactif.</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-md hover:shadow-lg"
          >
            <Plus size={18} /> Sous Réseau
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-1"><p className="text-xs text-slate-500">Sous-réseaux</p><p className="text-2xl font-bold text-slate-900">{totals.totalSubnets}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-1"><p className="text-xs text-slate-500">IP totales</p><p className="text-2xl font-bold text-slate-900">{totals.totalIps}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-1"><p className="text-xs text-slate-500">IP utilisées</p><p className="text-2xl font-bold text-blue-600">{totals.totalUsed}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-1"><p className="text-xs text-slate-500">IP libres</p><p className="text-2xl font-bold text-emerald-600">{totals.totalFree}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-1"><p className="text-xs text-slate-500">Occupation moyenne</p><p className="text-2xl font-bold text-amber-600">{Math.round(totals.avgOccupancy)}%</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-1"><p className="text-xs text-slate-500">Conflits</p><p className="text-2xl font-bold text-rose-600">{totals.conflicts}</p></div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4"><Network size={18} className="text-blue-600" /><h2 className="text-lg font-bold">Visualisation des subnets existants</h2></div>
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
                          setEditingId(item.subnet.id);
                          setFormData({
                            name: item.subnet.name,
                            mainNetworkCidr: item.subnet.mainNetworkCidr,
                            calculationMode: 'hosts',
                            hostCount: item.subnet.usableHosts,
                            subnetCount: 1,
                            subnetIndexMode: 'index',
                            subnetIndex: index,
                            allocation: item.subnet.allocation,
                          });
                          setShowModal(true);
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
                    <p className="col-span-2">Plage IP: <span className="font-mono text-slate-700">{item.subnet.rangeStart} → {item.subnet.rangeEnd}</span></p>
                    <p>IP totales: <span className="font-semibold text-slate-700">{item.totalIps}</span></p>
                    <p>IP utilisées: <span className="font-semibold text-blue-700">{item.used}</span></p>
                    <p>IP libres: <span className="font-semibold text-emerald-700">{item.free}</span></p>
                    <p>Taux d’occupation: <span className="font-semibold text-amber-700">{Math.round(item.occupancy)}%</span></p>
                  </div>

                  <div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${item.occupancy}%` }} />
                    </div>
                  </div>

                  <div className="text-xs">
                    {item.conflicts.length > 0 ? (
                      <p className="text-rose-600 font-semibold">Conflits: {item.conflicts.join(', ')}</p>
                    ) : (
                      <p className="text-emerald-600 font-semibold">Conflits: Aucun</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2"><Wifi size={18} className="text-emerald-600" /><h2 className="text-lg font-bold">Test ICMP temps réel</h2></div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">IP ou hostname</label>
              <input value={pingTarget} onChange={(e) => setPingTarget(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="192.168.1.10 ou srv-ad" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void runPingTest()} disabled={pingLoading} className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{pingLoading ? 'Test…' : 'Lancer test'}</button>
              <button onClick={() => setPingLive((v) => !v)} className={`rounded-lg px-3 py-2 text-xs font-semibold border ${pingLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                <RefreshCw size={14} className={`inline mr-1 ${pingLive ? 'animate-spin' : ''}`} /> Live
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <p>Statut: <span className={`font-semibold ${pingResult?.reachable ? 'text-emerald-700' : 'text-rose-700'}`}>{pingResult ? (pingResult.reachable ? 'Accessible' : 'Inaccessible') : '—'}</span></p>
              <p>Temps de réponse: <span className="font-semibold text-slate-800">{pingResult?.elapsedMs != null ? `${pingResult.elapsedMs} ms` : '—'}</span></p>
              <p>Paquets envoyés/reçus: <span className="font-semibold text-slate-800">{pingResult?.sent ?? '—'} / {pingResult?.received ?? '—'}</span></p>
              <p>Latence moyenne: <span className="font-semibold text-slate-800">{pingResult?.avgLatencyMs != null ? `${pingResult.avgLatencyMs} ms` : '—'}</span></p>
              {pingResult?.error && <p className="text-rose-600 font-semibold">{pingResult.error}</p>}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2"><Calculator size={18} className="text-indigo-600" /><h2 className="text-lg font-bold">Espace de calcul temps réel</h2></div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-100/70 border border-slate-200 p-4 space-y-4">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-xs font-bold tracking-wide uppercase">Informations générales</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Méthode de calcul</p>
                <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="calcMode" checked={calcMode === 'cidr'} onChange={() => setCalcMode('cidr')} />
                    Par CIDR
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="calcMode" checked={calcMode === 'mask'} onChange={() => setCalcMode('mask')} />
                    Par masque décimal
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="calcMode" checked={calcMode === 'hosts'} onChange={() => setCalcMode('hosts')} />
                    Par nombre d’hôtes
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="calcMode" checked={calcMode === 'subnets'} onChange={() => setCalcMode('subnets')} />
                    Par nombre de sous-réseaux
                  </label>
                </div>
              </div>

              {calcMode === 'cidr' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Réseau (CIDR) *</label>
                    <input value={calcCidr} onChange={(e) => setCalcCidr(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="192.168.10.0/24" />
                  </div>
                </div>
              )}

              {calcMode === 'mask' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Adresse IP *</label>
                    <input value={calcIp} onChange={(e) => setCalcIp(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="192.168.10.10" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Masque décimal *</label>
                    <input value={calcMask} onChange={(e) => setCalcMask(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="255.255.255.0" />
                  </div>
                </div>
              )}
            </div>

            {(calcMode === 'hosts' || calcMode === 'subnets') && (
              <div className="rounded-2xl bg-slate-100/70 border border-slate-200 p-4 space-y-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="text-xs font-bold tracking-wide uppercase">Paramètres de calcul</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Réseau principal (CIDR) *</label>
                    <input value={calcMainCidr} onChange={(e) => setCalcMainCidr(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="192.168.0.0/16" />
                  </div>

                  {calcMode === 'hosts' ? (
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">Nombre d’hôtes requis *</label>
                      <input type="number" min={1} value={calcHosts} onChange={(e) => setCalcHosts(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="50" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">Nombre de sous-réseaux *</label>
                      <input type="number" min={1} value={calcSubnets} onChange={(e) => setCalcSubnets(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="4" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!calculatorResult.valid ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{calculatorResult.error || 'Entrées invalides.'}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
              {([
                { label: 'Adresse réseau', value: calculatorResult.networkAddress },
                { label: 'Adresse broadcast', value: calculatorResult.broadcastAddress },
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
            <p className="font-semibold text-slate-700">Conversion binaire / décimal</p>
            {binaryView ? (
              <>
                <p>Réseau binaire: <span className="font-mono text-slate-800">{binaryView.network}</span></p>
                <p>Masque binaire: <span className="font-mono text-slate-800">{binaryView.mask}</span></p>
              </>
            ) : (
              <p className="text-slate-500">Résultat requis pour afficher la conversion.</p>
            )}
          </div>
        </section>

        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Modifier un sous-réseau' : 'Ajouter un sous-réseau'}</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100"><Trash2 size={16} /></button>
              </div>

              {formError && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nom du subnet" />
                  <input value={formData.mainNetworkCidr} onChange={(e) => setFormData({ ...formData, mainNetworkCidr: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Réseau principal CIDR" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select value={formData.calculationMode} onChange={(e) => setFormData({ ...formData, calculationMode: e.target.value as 'hosts' | 'subnets' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="hosts">Par hôtes</option>
                    <option value="subnets">Par sous-réseaux</option>
                  </select>

                  {formData.calculationMode === 'hosts' ? (
                    <input type="number" min={1} value={formData.hostCount} onChange={(e) => setFormData({ ...formData, hostCount: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nombre d’hôtes" required />
                  ) : (
                    <input type="number" min={1} value={formData.subnetCount} onChange={(e) => setFormData({ ...formData, subnetCount: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nombre de sous-réseaux" required />
                  )}

                  <input value={formData.allocation} onChange={(e) => setFormData({ ...formData, allocation: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Service / Département" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select value={formData.subnetIndexMode} onChange={(e) => setFormData({ ...formData, subnetIndexMode: e.target.value as 'auto' | 'index' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="auto">Index auto</option>
                    <option value="index">Index précis</option>
                  </select>
                  {formData.subnetIndexMode === 'index' && (
                    <input type="number" min={1} value={formData.subnetIndex} onChange={(e) => setFormData({ ...formData, subnetIndex: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Index" required />
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  {formPlan.valid ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700">
                      <p>CIDR: <span className="font-mono">{formPlan.subnetCidr}</span></p>
                      <p>Masque: <span className="font-mono">{formPlan.netmask}</span></p>
                      <p>Adresse réseau: <span className="font-mono">{formPlan.networkAddress}</span></p>
                      <p>Broadcast: <span className="font-mono">{formPlan.broadcastAddress}</span></p>
                      <p>Première IP: <span className="font-mono">{formPlan.firstIp}</span></p>
                      <p>Dernière IP: <span className="font-mono">{formPlan.lastIp}</span></p>
                      <p>Hôtes utilisables: <span className="font-semibold">{formPlan.usableHosts}</span></p>
                      <p>Sous-réseau index: <span className="font-semibold">{formPlan.subnetIndex}</span></p>
                    </div>
                  ) : (
                    <p className="text-rose-600">{formPlan.error || 'Données insuffisantes'}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700">{editingId ? 'Mettre à jour' : 'Créer le sous-réseau'}</button>
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 rounded-lg bg-slate-100 text-slate-700 py-2 text-sm font-semibold hover:bg-slate-200">Annuler</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
