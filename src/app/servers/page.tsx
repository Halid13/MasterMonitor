'use client';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import {
  AlertTriangle, Pencil, Plus, Trash2, X,
  Activity, ChevronDown, ChevronUp,
  HardDrive, Cpu, Server, CheckCircle2, XCircle,
  Clock, Wifi,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type StatusFilter = 'all' | 'normal' | 'attention' | 'critique';

export default function ServersPage() {
  const { servers, alerts, addServer, updateServerStatus, deleteServer } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', ipAddress: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverToDelete, setServerToDelete] = useState<{ id: string; name: string; ipAddress: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const serversRef = useRef(servers);
  const diagnosticRef = useRef<Record<string, { status: 'pending' | 'ok' | 'error'; message: string }>>({});
  const availRef = useRef<Record<string, { checks: number; online: number }>>({});
  const remoteSyncBusyRef = useRef(false);
  const remoteAbortRef = useRef<AbortController | null>(null);

  const toggleServices = (id: string) =>
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const getAvailabilityPct = (id: string): number | null => {
    const a = availRef.current[id];
    if (!a || a.checks === 0) return null;
    return (a.online / a.checks) * 100;
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 o';
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
    return `${(bytes / 1024).toFixed(0)} Ko`;
  };

  const emitServerLog = async (
    level: 'info' | 'warning' | 'error',
    action: string,
    serverName: string,
    ipAddress: string,
    details?: Record<string, any>,
  ) => {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'system', level, module: 'Server Monitoring',
          action, objectImpacted: `${serverName} (${ipAddress})`, details,
        }),
      });
    } catch { }
  };

  const setPendingDiagnostic = (id: string, msg: string, name: string, ip: string) => {
    diagnosticRef.current[id] = { status: 'pending', message: msg };
    void emitServerLog('info', msg, name, ip, { stage: 'pending', waitWindowSec: 15 });
  };

  const setOkDiagnostic = (id: string, msg: string, name: string, ip: string) => {
    const prev = diagnosticRef.current[id];
    diagnosticRef.current[id] = { status: 'ok', message: msg };
    if (!prev || prev.status !== 'ok' || prev.message !== msg) {
      void emitServerLog('info', msg, name, ip, { stage: 'success' });
    }
  };

  const setErrorDiagnostic = (id: string, msg: string, name: string, ip: string) => {
    const prev = diagnosticRef.current[id];
    diagnosticRef.current[id] = { status: 'error', message: msg };
    if (!prev || prev.status !== 'error' || prev.message !== msg) {
      void emitServerLog('error', msg, name, ip, { stage: 'error' });
    }
  };

  const getDiagnosticError = (data: any) => {
    const details = data?.details;
    const raw = typeof details === 'string'
      ? details
      : details?.stdout || details?.stderr || data?.error || 'Erreur de récupération distante.';
    const compact = String(raw).replace(/\s+/g, ' ').trim();
    if (compact.includes('Accès refusé')) return 'Accès refusé (vérifier compte WinRM/CIM).';
    if (compact.length > 140) return `${compact.slice(0, 140)}...`;
    return compact;
  };

  useEffect(() => { serversRef.current = servers; }, [servers]);

  useEffect(() => {
    let isMounted = true;
    const syncLocalServer = async () => {
      try {
        const res = await fetch('/api/system/metrics', { cache: 'no-store' });
        const data = await res.json();
        if (!isMounted || !data?.ok) return;
        const serverId = 'local-pc';
        const exists = serversRef.current.some((s) => s.id === serverId);
        const av = availRef.current;
        if (!av[serverId]) av[serverId] = { checks: 0, online: 0 };
        av[serverId].checks++;
        av[serverId].online++;
        const services = (data.services || []).map((svc: any, i: number) => ({
          id: `svc-local-${i}`, name: svc.name, status: svc.status as 'running' | 'stopped' | 'warning',
        }));
        const base = {
          id: serverId, name: data.host || 'Mon PC', ipAddress: data.ipAddress || '127.0.0.1',
          subnetMask: data.netmask ?? undefined, status: 'online' as const,
          healthScore: Math.round(100 - Math.max(data.cpu || 0, data.memory || 0)),
          metrics: {
            id: `${serverId}-metrics`, serverId,
            cpuUsage: data.cpu ?? 0, memoryUsage: data.memory ?? 0, diskUsage: data.disk ?? 0,
            networkIn: data.network?.incoming ?? 0, networkOut: data.network?.outgoing ?? 0,
            processCount: 0, uptime: data.uptime ?? 0, timestamp: new Date(),
          },
          lastHealthCheck: new Date(), services,
          diskTotal: data.diskDetail?.total ?? undefined, diskFree: data.diskDetail?.free ?? undefined,
          memTotal: data.memTotal ?? undefined, memFree: data.memFree ?? undefined,
        };
        if (!exists) { addServer(base); } else { updateServerStatus(serverId, base); }
        setOkDiagnostic(serverId, 'Métriques locales récupérées sans erreur.', base.name, base.ipAddress);
      } catch { }
    };
    syncLocalServer();
    const timer = setInterval(syncLocalServer, 5000);
    return () => { isMounted = false; clearInterval(timer); };
  }, [addServer, updateServerStatus]);

  useEffect(() => {
    let isMounted = true;
    const syncRemoteServers = async () => {
      if (remoteSyncBusyRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      remoteSyncBusyRef.current = true;
      const controller = new AbortController();
      remoteAbortRef.current = controller;

      const list = serversRef.current.filter((s) => s.id !== 'local-pc');
      let localSnapshot: any = null;
      try {
        const localRes = await fetch('/api/system/metrics', { cache: 'no-store', signal: controller.signal });
        const localData = await localRes.json();
        if (localData?.ok) localSnapshot = localData;
      } catch { }

      try {
        const pingReachable = async (ipAddress: string) => {
          try {
            const target = encodeURIComponent(ipAddress);
            const pingRes = await fetch(`/api/system/ping?target=${target}&count=2`, {
              cache: 'no-store',
              signal: controller.signal,
            });
            const pingData = await pingRes.json();
            return Boolean(pingData?.ok && pingData?.reachable);
          } catch {
            return false;
          }
        };

        await Promise.all(
          list.map(async (server) => {
            if (!server.ipAddress || !isMounted || controller.signal.aborted) return;
            const normalizedHost = server.ipAddress.trim().toLowerCase();
            const localHostNames = new Set([
              'localhost', '127.0.0.1',
              localSnapshot?.ipAddress ? String(localSnapshot.ipAddress).toLowerCase() : '',
              localSnapshot?.host ? String(localSnapshot.host).toLowerCase() : '',
            ]);
            if (localHostNames.has(normalizedHost) && localSnapshot) {
              const healthScore = Math.round(100 - Math.max(localSnapshot.cpu || 0, localSnapshot.memory || 0, localSnapshot.disk || 0));
              const av = availRef.current;
              if (!av[server.id]) av[server.id] = { checks: 0, online: 0 };
              av[server.id].checks++;
              av[server.id].online++;
              const services = (localSnapshot.services || []).map((svc: any, i: number) => ({
                id: `svc-${server.id}-${i}`, name: svc.name, status: svc.status as 'running' | 'stopped' | 'warning',
              }));
              if (!isMounted || controller.signal.aborted) return;
              updateServerStatus(server.id, {
                name: localSnapshot.host || server.name, subnetMask: localSnapshot.netmask ?? undefined,
                status: 'online', healthScore,
                metrics: {
                  ...server.metrics, cpuUsage: localSnapshot.cpu ?? 0, memoryUsage: localSnapshot.memory ?? 0,
                  diskUsage: localSnapshot.disk ?? 0, networkIn: localSnapshot.network?.incoming ?? server.metrics.networkIn,
                  networkOut: localSnapshot.network?.outgoing ?? server.metrics.networkOut,
                  uptime: localSnapshot.uptime ?? 0, timestamp: new Date(),
                },
                lastHealthCheck: new Date(), services,
                diskTotal: localSnapshot.diskDetail?.total ?? undefined, diskFree: localSnapshot.diskDetail?.free ?? undefined,
                memTotal: localSnapshot.memTotal ?? undefined, memFree: localSnapshot.memFree ?? undefined,
              });
              setOkDiagnostic(server.id, 'Serveur synchronisé (source locale).', server.name, server.ipAddress);
              return;
            }
            try {
              const host = encodeURIComponent(server.ipAddress);
              const [pingOk, remoteResult] = await Promise.all([
                pingReachable(server.ipAddress),
                fetch(`/api/system/remote-metrics?host=${host}`, { cache: 'no-store', signal: controller.signal })
                  .then((res) => res.json())
                  .then((data) => ({ ok: Boolean(data?.ok), data }))
                  .catch(() => ({ ok: false as const, data: null as any })),
              ]);

              const data = remoteResult.data;
              const metricsOk = remoteResult.ok;
              const av = availRef.current;
              if (!av[server.id]) av[server.id] = { checks: 0, online: 0 };
              av[server.id].checks++;
              if (!isMounted || controller.signal.aborted) return;

              // Server is ONLINE only if both checks are valid: Ping + WinRM/CIM metrics.
              if (!pingOk || !metricsOk) {
                if (isMounted && !controller.signal.aborted) {
                  const diagnostic = !pingOk && !metricsOk
                    ? `Validation incomplète: Ping KO + WinRM/CIM KO. ${getDiagnosticError(data)}`
                    : !pingOk
                      ? 'Validation incomplète: Ping KO (connectivité réseau indisponible).'
                      : `Validation incomplète: WinRM/CIM KO. ${getDiagnosticError(data)}`;
                  updateServerStatus(server.id, { status: pingOk ? 'warning' : 'offline' });
                  setErrorDiagnostic(server.id, diagnostic, server.name, server.ipAddress);
                }
                return;
              }

              av[server.id].online++;
              const healthScore = Math.round(100 - Math.max(data.cpu || 0, data.memory || 0, data.disk || 0));
              const services = (data.stoppedServices || []).map((name: string, i: number) => ({
                id: `svc-${server.id}-${i}`, name, status: 'stopped' as const,
              }));
              updateServerStatus(server.id, {
                name: data.host || server.name, subnetMask: data.subnetMask ?? undefined,
                status: 'online', healthScore,
                metrics: {
                  ...server.metrics, cpuUsage: data.cpu ?? 0, memoryUsage: data.memory ?? 0,
                  diskUsage: data.disk ?? 0, networkIn: server.metrics.networkIn,
                  networkOut: server.metrics.networkOut, uptime: data.uptime ?? 0, timestamp: new Date(),
                },
                lastHealthCheck: new Date(), services,
                diskTotal: data.diskTotal ?? undefined, diskFree: data.diskFree ?? undefined,
                memTotal: data.memTotal ?? undefined, memFree: data.memFree ?? undefined,
              });
              setOkDiagnostic(server.id, 'Métriques récupérées sans erreur.', data.host || server.name, server.ipAddress);
            } catch (error: any) {
              if (error?.name === 'AbortError') return;
              const av = availRef.current;
              if (!av[server.id]) av[server.id] = { checks: 0, online: 0 };
              av[server.id].checks++;
              if (!isMounted || controller.signal.aborted) return;
              updateServerStatus(server.id, { status: 'offline' });
              setErrorDiagnostic(server.id, 'Validation incomplète: Ping/WinRM indisponibles.', server.name, server.ipAddress);
            }
          }),
        );
      } finally {
        if (remoteAbortRef.current === controller) {
          remoteAbortRef.current = null;
        }
        remoteSyncBusyRef.current = false;
      }
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const runLoop = async () => {
      if (!isMounted) return;
      await syncRemoteServers();
      if (!isMounted) return;
      timer = setTimeout(runLoop, 10000);
    };

    const onVisible = () => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void syncRemoteServers();
    };

    void runLoop();
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      remoteAbortRef.current?.abort();
      remoteAbortRef.current = null;
      remoteSyncBusyRef.current = false;
    };
  }, [updateServerStatus]);

  const getThresholdStatus = (value: number, warning: number, critical: number) => {
    if (value >= critical) return 'critique';
    if (value >= warning) return 'attention';
    return 'normal';
  };
  const getServiceStatus = (services: { status: string }[]) => {
    if (services.some((s) => s.status === 'stopped')) return 'critique';
    if (services.some((s) => s.status === 'warning')) return 'attention';
    return 'normal';
  };
  const getServerStatus = (server: typeof servers[number]) => {
    const cpuStatus = getThresholdStatus(server.metrics.cpuUsage, 70, 85);
    const ramStatus = getThresholdStatus(server.metrics.memoryUsage, 75, 90);
    const diskStatus = getThresholdStatus(server.metrics.diskUsage, 80, 90);
    const serviceStatus = getServiceStatus(server.services);
    if ([cpuStatus, ramStatus, diskStatus, serviceStatus].includes('critique')) return 'critique';
    if ([cpuStatus, ramStatus, diskStatus, serviceStatus].includes('attention')) return 'attention';
    return 'normal';
  };

  const averageHealth = servers.length > 0 ? Math.round(servers.reduce((s, sv) => s + sv.healthScore, 0) / servers.length) : 0;
  const averageCPU = servers.length > 0 ? (servers.reduce((s, sv) => s + sv.metrics.cpuUsage, 0) / servers.length).toFixed(1) : 0;
  const averageMemory = servers.length > 0 ? (servers.reduce((s, sv) => s + sv.metrics.memoryUsage, 0) / servers.length).toFixed(1) : 0;
  const averageDisk = servers.length > 0 ? (servers.reduce((s, sv) => s + sv.metrics.diskUsage, 0) / servers.length).toFixed(1) : 0;
  const averageLoad = averageCPU;
  const averageUptime = servers.length > 0 ? servers.reduce((s, sv) => s + sv.metrics.uptime, 0) / servers.length : 0;
  const averageNetIn = servers.length > 0 ? servers.reduce((s, sv) => s + sv.metrics.networkIn, 0) / servers.length : 0;
  const averageNetOut = servers.length > 0 ? servers.reduce((s, sv) => s + sv.metrics.networkOut, 0) / servers.length : 0;
  const onlineCount = servers.filter((s) => s.status === 'online').length;
  const offlineCount = servers.filter((s) => s.status === 'offline').length;
  const totalServices = servers.reduce((s, sv) => s + sv.services.length, 0);
  const servicesDown = servers.reduce((s, sv) => s + sv.services.filter((svc) => svc.status === 'stopped').length, 0);
  const servicesWarning = servers.reduce((s, sv) => s + sv.services.filter((svc) => svc.status === 'warning').length, 0);
  const incidentCount = alerts.length;
  const criticalIncidents = alerts.filter((a) => a.type === 'critical').length;
  const normalCount = servers.filter((s) => getServerStatus(s) === 'normal').length;
  const attentionCount = servers.filter((s) => getServerStatus(s) === 'attention').length;
  const critiqueCount = servers.filter((s) => getServerStatus(s) === 'critique').length;
  const filteredServers = statusFilter === 'all' ? servers : servers.filter((s) => getServerStatus(s) === statusFilter);

  const statusBadge = (status: 'normal' | 'attention' | 'critique') => {
    if (status === 'critique') return 'bg-red-100 text-red-700';
    if (status === 'attention') return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };
  const statusDot = (status: 'normal' | 'attention' | 'critique') => {
    if (status === 'critique') return 'bg-red-500';
    if (status === 'attention') return 'bg-yellow-500';
    return 'bg-green-500';
  };
  const cardAccent = (status: 'normal' | 'attention' | 'critique') => {
    if (status === 'critique') return 'border-red-200 shadow-red-100/60';
    if (status === 'attention') return 'border-yellow-200 shadow-yellow-100/60';
    return 'border-slate-200/60';
  };
  const accentBar = (status: 'normal' | 'attention' | 'critique') => {
    if (status === 'critique') return 'bg-gradient-to-r from-red-500 to-rose-500';
    if (status === 'attention') return 'bg-gradient-to-r from-yellow-400 to-amber-500';
    return 'bg-gradient-to-r from-emerald-400 to-green-500';
  };
  const availColor = (pct: number) => {
    if (pct >= 99) return 'text-emerald-600';
    if (pct >= 95) return 'text-yellow-600';
    return 'text-red-600';
  };
  const formatUptime = (seconds: number) => {
    if (!seconds) return '0h';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days > 0 ? `${days}j ${hours}h` : `${hours}h`;
  };
  const formatThroughput = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mo/s`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)} Ko/s`;
    return `${value.toFixed(0)} o/s`;
  };
  const normalizeHost = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const noProtocol = trimmed.replace(/^https?:\/\//i, '');
    const noPath = noProtocol.split('/')[0];
    const noPort = noPath.replace(/:(\d+)$/, '');
    return noPort.trim();
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedIpAddress = normalizeHost(formData.ipAddress);
    if (!formData.name.trim() || !normalizedIpAddress) return;
    if (editingId) {
      setPendingDiagnostic(editingId, 'Serveur modifié. Synchronisation en cours (10–15s)...', formData.name.trim(), normalizedIpAddress);
      updateServerStatus(editingId, { name: formData.name.trim(), ipAddress: normalizedIpAddress });
      setEditingId(null);
    } else {
      const id = Date.now().toString();
      setPendingDiagnostic(id, 'Serveur ajouté. Récupération des métriques en cours (10–15s)...', formData.name.trim(), normalizedIpAddress);
      addServer({
        id, name: formData.name.trim(), ipAddress: normalizedIpAddress, status: 'warning', healthScore: 0,
        metrics: { id: `${id}-metrics`, serverId: id, cpuUsage: 0, memoryUsage: 0, diskUsage: 0, networkIn: 0, networkOut: 0, processCount: 0, uptime: 0, timestamp: new Date() },
        lastHealthCheck: new Date(), services: [],
      });
    }
    setFormData({ name: '', ipAddress: '' });
    setShowModal(false);
  };
  const handleEdit = (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setFormData({ name: server.name, ipAddress: server.ipAddress });
    setEditingId(id);
    setShowModal(true);
  };
  const handleDelete = (id: string) => {
    if (id === 'local-pc') return;
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setServerToDelete({ id: server.id, name: server.name, ipAddress: server.ipAddress });
  };
  const confirmDeleteServer = async () => {
    if (!serverToDelete) return;
    setIsDeleting(true);
    try {
      await emitServerLog('warning', 'Serveur supprimé de la supervision.', serverToDelete.name, serverToDelete.ipAddress, { stage: 'delete' });
      await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deletedServers: [{ id: serverToDelete.id, ipAddress: serverToDelete.ipAddress }],
        }),
      });
      deleteServer(serverToDelete.id);
      delete diagnosticRef.current[serverToDelete.id];
      setServerToDelete(null);
    } finally { setIsDeleting(false); }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Supervision des serveurs</h1>
            <p className="text-gray-600 mt-2">Disponibilité, métriques et alertes en temps réel</p>
          </div>
          <button type="button" onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
            <Plus size={18} /> Ajouter un serveur
          </button>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Modifier le serveur' : 'Ajouter un serveur'}</h2>
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setFormData({ name: '', ipAddress: '' }); }} className="p-2 rounded-md hover:bg-gray-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleAddServer} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom du serveur</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="SRV-01" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Adresse IP</label>
                  <input type="text" value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="192.168.1.10" required />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" className="flex-1 rounded-md bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700">{editingId ? 'Enregistrer' : 'Ajouter'}</button>
                  <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setFormData({ name: '', ipAddress: '' }); }} className="flex-1 rounded-md bg-gray-100 text-gray-700 py-2 text-sm font-semibold hover:bg-gray-200">Annuler</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {serverToDelete && (
          <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isDeleting && setServerToDelete(null)}>
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center"><AlertTriangle size={18} /></div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">Supprimer ce serveur ?</h3>
                  <p className="text-xs text-slate-500 mt-1">Cette action retire le serveur de la supervision active.</p>
                </div>
                <button type="button" onClick={() => setServerToDelete(null)} disabled={isDeleting} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={16} /></button>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-900">{serverToDelete.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{serverToDelete.ipAddress}</p>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <button type="button" onClick={() => setServerToDelete(null)} disabled={isDeleting} className="flex-1 rounded-lg bg-slate-100 text-slate-700 py-2 text-sm font-semibold hover:bg-slate-200 disabled:opacity-60">Annuler</button>
                <button type="button" onClick={confirmDeleteServer} disabled={isDeleting} className="flex-1 rounded-lg bg-rose-600 text-white py-2 text-sm font-semibold hover:bg-rose-700 disabled:opacity-70">{isDeleting ? 'Suppression…' : 'Supprimer'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Critères de surveillance et seuils d'alerte</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div><p className="font-medium text-slate-700 mb-1">CPU</p><p className="text-slate-600">• <span className="text-yellow-600 font-medium">Attention</span> : ≥70%</p><p className="text-slate-600">• <span className="text-red-600 font-medium">Critique</span> : ≥85%</p></div>
                <div><p className="font-medium text-slate-700 mb-1">RAM</p><p className="text-slate-600">• <span className="text-yellow-600 font-medium">Attention</span> : ≥75%</p><p className="text-slate-600">• <span className="text-red-600 font-medium">Critique</span> : ≥90%</p></div>
                <div><p className="font-medium text-slate-700 mb-1">Disque</p><p className="text-slate-600">• <span className="text-yellow-600 font-medium">Attention</span> : ≥80%</p><p className="text-slate-600">• <span className="text-red-600 font-medium">Critique</span> : ≥90%</p></div>
                <div><p className="font-medium text-slate-700 mb-1">Services</p><p className="text-slate-600">• <span className="text-yellow-600 font-medium">Attention</span> : warning</p><p className="text-slate-600">• <span className="text-red-600 font-medium">Critique</span> : arrêté</p></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Santé moyenne</p><p className="text-3xl font-bold text-blue-600">{averageHealth}%</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">CPU moyen</p><p className="text-3xl font-bold text-orange-600">{averageCPU}%</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">RAM moyen</p><p className="text-3xl font-bold text-purple-600">{averageMemory}%</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Serveurs en ligne</p><p className="text-3xl font-bold text-green-600">{onlineCount}</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Serveurs hors ligne</p><p className="text-3xl font-bold text-red-600">{offlineCount}</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Disque moyen</p><p className="text-3xl font-bold text-amber-600">{averageDisk}%</p><p className="text-xs text-gray-500 mt-2">Charge moyenne CPU: {averageLoad}%</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Réseau moyen</p><p className="text-lg font-bold text-indigo-600">⬇ {formatThroughput(averageNetIn)}</p><p className="text-lg font-bold text-purple-600">⬆ {formatThroughput(averageNetOut)}</p><p className="text-xs text-gray-500 mt-2">Uptime moyen: {formatUptime(averageUptime)}</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Incidents</p><p className="text-3xl font-bold text-rose-600">{incidentCount}</p><p className="text-xs text-gray-500 mt-2">Critiques: {criticalIncidents}</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Services surveillés</p><p className="text-3xl font-bold text-slate-700">{totalServices}</p><p className="text-xs text-gray-500 mt-2">Avertissements: {servicesWarning} • Arrêtés: {servicesDown}</p></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-600 mb-2">Dernier contrôle</p><p className="text-2xl font-bold text-slate-700">{servers[0] ? new Date(servers[0].lastHealthCheck).toLocaleString('fr-FR') : '—'}</p></div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-gray-900">État détaillé des serveurs</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Filtrer :</span>
              {([
                { key: 'all' as StatusFilter, label: 'Tous', count: servers.length, dot: 'bg-slate-400', cls: 'border-slate-200 text-slate-700 bg-slate-50' },
                { key: 'normal' as StatusFilter, label: 'Normal', count: normalCount, dot: 'bg-green-500', cls: 'border-green-200 text-green-700 bg-green-50' },
                { key: 'attention' as StatusFilter, label: 'Attention', count: attentionCount, dot: 'bg-yellow-500', cls: 'border-yellow-200 text-yellow-700 bg-yellow-50' },
                { key: 'critique' as StatusFilter, label: 'Critique', count: critiqueCount, dot: 'bg-red-500', cls: 'border-red-200 text-red-700 bg-red-50' },
              ]).map(({ key, label, count, dot, cls }) => (
                <button key={key} type="button" onClick={() => setStatusFilter(key)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${cls} ${statusFilter === key ? 'ring-2 ring-offset-1 ring-blue-400 shadow-sm' : 'hover:opacity-80'}`}>
                  <span className={`h-2 w-2 rounded-full ${dot}`} />{label} ({count})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredServers.length > 0 ? filteredServers.map((server) => {
              const cpuStatus = getThresholdStatus(server.metrics.cpuUsage, 70, 85);
              const ramStatus = getThresholdStatus(server.metrics.memoryUsage, 75, 90);
              const diskStatus = getThresholdStatus(server.metrics.diskUsage, 80, 90);
              const serviceStatus = getServiceStatus(server.services);
              const serverStatus = getServerStatus(server);
              const incidents = alerts.filter((a) => a.source === server.name).slice(0, 4);
              const availPct = getAvailabilityPct(server.id);
              const stoppedServices = server.services.filter((s) => s.status === 'stopped');
              const runningServices = server.services.filter((s) => s.status === 'running');
              const alertItems = [
                cpuStatus !== 'normal' ? { label: 'Surcharge CPU', status: cpuStatus } : null,
                ramStatus !== 'normal' ? { label: 'RAM élevée', status: ramStatus } : null,
                diskStatus !== 'normal' ? { label: 'Disque plein', status: diskStatus } : null,
                serviceStatus !== 'normal' ? { label: 'Service indisponible', status: serviceStatus } : null,
              ].filter(Boolean) as { label: string; status: 'normal' | 'attention' | 'critique' }[];

              return (
                <div key={server.id} className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br from-white/90 via-white/70 to-slate-50/80 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] transition hover:shadow-[0_25px_70px_-35px_rgba(15,23,42,0.4)] ${cardAccent(serverStatus)}`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-3xl ${accentBar(serverStatus)}`} />
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-100/40 blur-3xl" />
                  <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-indigo-100/40 blur-3xl" />

                  <div className="relative flex flex-wrap items-start justify-between gap-4 mt-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{server.status}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(serverStatus)}`}>{serverStatus}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900">{server.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Wifi size={11} className="text-slate-400" />
                        <span className="font-mono">{server.ipAddress}</span>
                        {server.subnetMask && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">/{server.subnetMask}</span>}
                      </div>
                      <p className="text-xs text-slate-400">Contrôle : {new Date(server.lastHealthCheck).toLocaleTimeString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleEdit(server.id)} className="rounded-full border border-slate-200/70 bg-white/80 p-2 text-slate-600 hover:bg-slate-100" title="Modifier"><Pencil size={14} /></button>
                      <button type="button" onClick={() => handleDelete(server.id)} className={`rounded-full border border-slate-200/70 p-2 ${server.id === 'local-pc' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`} title={server.id === 'local-pc' ? 'Serveur local non supprimable' : 'Supprimer'} disabled={server.id === 'local-pc'}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Server size={11} /> Santé globale</div>
                      <p className="text-2xl font-semibold text-slate-900">{server.healthScore}%</p>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500" style={{ width: `${server.healthScore}%` }} /></div>
                      <p className="mt-1.5 text-[10px] text-slate-400">Synthèse CPU, RAM, disque</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Clock size={11} /> Uptime</div>
                      <p className="text-2xl font-semibold text-slate-900">{formatUptime(server.metrics.uptime)}</p>
                      {availPct !== null && (
                        <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${availColor(availPct)}`}><Activity size={10} /><span>{availPct.toFixed(1)}% disponibilité</span></div>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">Depuis le dernier démarrage</p>
                    </div>
                  </div>

                  <div className="relative mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Cpu size={11} /> CPU</div>
                      <p className="text-lg font-semibold text-slate-900">{server.metrics.cpuUsage.toFixed(1)}%</p>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${cpuStatus === 'critique' ? 'bg-red-500' : cpuStatus === 'attention' ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, server.metrics.cpuUsage)}%` }} /></div>
                      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(cpuStatus as any)}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot(cpuStatus as any)}`} />{cpuStatus}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Server size={11} /> RAM</div>
                      <p className="text-lg font-semibold text-slate-900">{server.metrics.memoryUsage.toFixed(1)}%</p>
                      {server.memTotal && server.memFree && <p className="text-[10px] text-slate-400 -mt-0.5">{formatBytes(server.memTotal - server.memFree)} / {formatBytes(server.memTotal)}</p>}
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${ramStatus === 'critique' ? 'bg-red-500' : ramStatus === 'attention' ? 'bg-yellow-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(100, server.metrics.memoryUsage)}%` }} /></div>
                      <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(ramStatus as any)}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot(ramStatus as any)}`} />{ramStatus}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><HardDrive size={11} /> Disque</div>
                      <p className="text-lg font-semibold text-slate-900">{server.metrics.diskUsage.toFixed(1)}%</p>
                      {server.diskTotal && server.diskFree && <p className="text-[10px] text-slate-400 -mt-0.5">{formatBytes(server.diskTotal - server.diskFree)} / {formatBytes(server.diskTotal)}</p>}
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${diskStatus === 'critique' ? 'bg-red-500' : diskStatus === 'attention' ? 'bg-yellow-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, server.metrics.diskUsage)}%` }} /></div>
                      <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(diskStatus as any)}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot(diskStatus as any)}`} />{diskStatus}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Wifi size={11} /> Réseau</div>
                      <p className="text-sm font-semibold text-slate-900">⬇ {formatThroughput(server.metrics.networkIn)}</p>
                      <p className="text-sm font-semibold text-slate-900">⬆ {formatThroughput(server.metrics.networkOut)}</p>
                      <p className="mt-1.5 text-[10px] text-slate-400">Débit entrant / sortant</p>
                    </div>
                  </div>

                  <div className="relative mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-slate-500 text-xs">État services</p>
                        {server.services.length > 0 && (
                          <button type="button" onClick={() => toggleServices(server.id)} className="p-0.5 text-slate-400 hover:text-slate-700 transition" title={expandedServices.has(server.id) ? 'Réduire' : 'Détailler'}>
                            {expandedServices.has(server.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(serviceStatus as any)}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot(serviceStatus as any)}`} />{serviceStatus}</div>
                      {expandedServices.has(server.id) && server.services.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {stoppedServices.map((svc) => (<div key={svc.id} className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium"><XCircle size={10} className="shrink-0" /><span className="truncate">{svc.name}</span></div>))}
                          {runningServices.map((svc) => (<div key={svc.id} className="flex items-center gap-1.5 text-[10px] text-emerald-600"><CheckCircle2 size={10} className="shrink-0" /><span className="truncate">{svc.name}</span></div>))}
                        </div>
                      )}
                      {!expandedServices.has(server.id) && server.services.length > 0 && (
                        <p className="mt-1 text-[10px] text-slate-400">{stoppedServices.length > 0 ? `${stoppedServices.length} arrêté(s) / ${server.services.length} surveillé(s)` : `${runningServices.length} actif(s)`}</p>
                      )}
                      {server.services.length === 0 && <p className="mt-1 text-[10px] text-slate-400">Aucun service surveillé</p>}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                      <p className="text-slate-500 text-xs mb-1">Alertes actives</p>
                      {alertItems.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold mt-1"><CheckCircle2 size={11} />Aucune alerte</div>
                      ) : (
                        <div className="mt-1 space-y-1.5">
                          {alertItems.map((a) => (<div key={a.label} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(a.status)}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot(a.status)}`} />{a.label}</div>))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative mt-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
                    <p className="text-xs text-slate-500 mb-2">Historique incidents récents</p>
                    {incidents.length === 0 ? (
                      <p className="text-xs text-slate-400">Aucun incident enregistré pour ce serveur</p>
                    ) : (
                      <div className="space-y-2">
                        {incidents.map((inc) => (
                          <div key={inc.id} className="flex items-start gap-2">
                            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${inc.type === 'critical' ? 'bg-red-500' : inc.type === 'error' ? 'bg-orange-500' : inc.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-800 truncate">{inc.title}</p>
                              <p className="text-[10px] text-slate-400">{new Date(inc.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · {inc.type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500">{statusFilter === 'all' ? 'Aucun serveur configuré' : `Aucun serveur avec le statut « ${statusFilter} »`}</p>
                {statusFilter === 'all' && <p className="text-sm text-gray-400 mt-2">Ajoutez des serveurs depuis le tableau de bord</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
