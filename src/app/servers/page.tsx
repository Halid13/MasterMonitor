'use client';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function ServersPage() {
  const { servers, alerts, addServer, updateServerStatus, deleteServer } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', ipAddress: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const serversRef = useRef(servers);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  useEffect(() => {
    let isMounted = true;

    const syncLocalServer = async () => {
      try {
        const res = await fetch('/api/system/metrics', { cache: 'no-store' });
        const data = await res.json();
        if (!isMounted || !data?.ok) return;

        const serverId = 'local-pc';
        const exists = servers.some((s) => s.id === serverId);

        const base = {
          id: serverId,
          name: data.host || 'Mon PC',
          ipAddress: data.ipAddress || '127.0.0.1',
          status: 'online' as const,
          healthScore: Math.round(100 - Math.max(data.cpu || 0, data.memory || 0)),
          metrics: {
            id: `${serverId}-metrics`,
            serverId,
            cpuUsage: data.cpu ?? 0,
            memoryUsage: data.memory ?? 0,
            diskUsage: data.disk ?? 0,
            networkIn: data.network?.incoming ?? 0,
            networkOut: data.network?.outgoing ?? 0,
            processCount: 0,
            uptime: data.uptime ?? 0,
            timestamp: new Date(),
          },
          lastHealthCheck: new Date(),
          services: [],
        };

        if (!exists) {
          addServer(base);
        } else {
          updateServerStatus(serverId, base);
        }
      } catch {
        // ignore
      }
    };

    syncLocalServer();
    const timer = setInterval(syncLocalServer, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [addServer, servers, updateServerStatus]);

  useEffect(() => {
    let isMounted = true;

    const syncRemoteServers = async () => {
      const list = serversRef.current.filter((s) => s.id !== 'local-pc');
      await Promise.all(
        list.map(async (server) => {
          if (!server.ipAddress) return;
          try {
            const res = await fetch(`/api/system/remote-metrics?host=${server.ipAddress}`, { cache: 'no-store' });
            const data = await res.json();
            if (!isMounted || !data?.ok) {
              updateServerStatus(server.id, { status: 'warning' });
              return;
            }
            const healthScore = Math.round(100 - Math.max(data.cpu || 0, data.memory || 0, data.disk || 0));
            updateServerStatus(server.id, {
              name: data.host || server.name,
              status: 'online',
              healthScore,
              metrics: {
                ...server.metrics,
                cpuUsage: data.cpu ?? 0,
                memoryUsage: data.memory ?? 0,
                diskUsage: data.disk ?? 0,
                uptime: data.uptime ?? 0,
                timestamp: new Date(),
              },
              lastHealthCheck: new Date(),
            });
          } catch {
            updateServerStatus(server.id, { status: 'offline' });
          }
        }),
      );
    };

    syncRemoteServers();
    const timer = setInterval(syncRemoteServers, 10000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [updateServerStatus]);

  const averageHealth = servers.length > 0
    ? Math.round(servers.reduce((sum, s) => sum + s.healthScore, 0) / servers.length)
    : 0;

  const averageCPU = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.cpuUsage, 0) / servers.length).toFixed(1)
    : 0;

  const averageMemory = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.memoryUsage, 0) / servers.length).toFixed(1)
    : 0;

  const averageDisk = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.diskUsage, 0) / servers.length).toFixed(1)
    : 0;

  const averageLoad = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.cpuUsage, 0) / servers.length).toFixed(1)
    : 0;

  const averageUptime = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.uptime, 0) / servers.length)
    : 0;

  const averageNetIn = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.networkIn, 0) / servers.length)
    : 0;

  const averageNetOut = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.networkOut, 0) / servers.length)
    : 0;

  const onlineCount = servers.filter(s => s.status === 'online').length;
  const offlineCount = servers.filter(s => s.status === 'offline').length;
  const totalServices = servers.reduce((sum, s) => sum + s.services.length, 0);
  const servicesDown = servers.reduce((sum, s) => sum + s.services.filter((svc) => svc.status === 'stopped').length, 0);
  const servicesWarning = servers.reduce((sum, s) => sum + s.services.filter((svc) => svc.status === 'warning').length, 0);
  const incidentCount = alerts.length;
  const criticalIncidents = alerts.filter((a) => a.type === 'critical').length;

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
    const diskStatus = getThresholdStatus(server.metrics.diskUsage, 80, 90);
    const serviceStatus = getServiceStatus(server.services);
    if ([cpuStatus, diskStatus, serviceStatus].includes('critique')) return 'critique';
    if ([cpuStatus, diskStatus, serviceStatus].includes('attention')) return 'attention';
    return 'normal';
  };

  const statusBadge = (status: 'normal' | 'attention' | 'critique') => {
    switch (status) {
      case 'critique':
        return 'bg-red-100 text-red-700';
      case 'attention':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  const statusDot = (status: 'normal' | 'attention' | 'critique') => {
    switch (status) {
      case 'critique':
        return 'bg-red-500';
      case 'attention':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
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

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.ipAddress.trim()) return;

    if (editingId) {
      updateServerStatus(editingId, {
        name: formData.name.trim(),
        ipAddress: formData.ipAddress.trim(),
      });
      setEditingId(null);
    } else {
      const id = Date.now().toString();
      addServer({
        id,
        name: formData.name.trim(),
        ipAddress: formData.ipAddress.trim(),
        status: 'online',
        healthScore: 100,
        metrics: {
          id: `${id}-metrics`,
          serverId: id,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          networkIn: 0,
          networkOut: 0,
          processCount: 0,
          uptime: 0,
          timestamp: new Date(),
        },
        lastHealthCheck: new Date(),
        services: [],
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
    if (window.confirm('Supprimer ce serveur ?')) {
      deleteServer(id);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Supervision des serveurs</h1>
            <p className="text-gray-600 mt-2">État et métriques de tous vos serveurs</p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            <Plus size={18} /> Ajouter un serveur
          </button>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Modifier le serveur' : 'Ajouter un serveur'}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData({ name: '', ipAddress: '' });
                  }}
                  className="p-2 rounded-md hover:bg-gray-100"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddServer} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom du serveur</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="SRV-01"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Adresse IP</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="192.168.1.10"
                    required
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-md bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700"
                  >
                    {editingId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData({ name: '', ipAddress: '' });
                    }}
                    className="flex-1 rounded-md bg-gray-100 text-gray-700 py-2 text-sm font-semibold hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Santé moyenne</p>
            <p className="text-3xl font-bold text-blue-600">{averageHealth}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">CPU moyen</p>
            <p className="text-3xl font-bold text-orange-600">{averageCPU}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">RAM moyen</p>
            <p className="text-3xl font-bold text-purple-600">{averageMemory}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Serveurs en ligne</p>
            <p className="text-3xl font-bold text-green-600">{onlineCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Serveurs hors ligne</p>
            <p className="text-3xl font-bold text-red-600">{offlineCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Analyse rapide</h3>
            <div className="text-xs text-gray-500">Seuils: CPU ≥ 70% (attention) ≥ 85% (critique)</div>
            <div className="text-xs text-gray-500">RAM ≥ 75% (attention) ≥ 90% (critique)</div>
            <div className="text-xs text-gray-500">Disque ≥ 80% (attention) ≥ 90% (critique)</div>
            <div className="text-xs text-gray-500">Services arrêtés → critique</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Disque moyen</p>
            <p className="text-3xl font-bold text-amber-600">{averageDisk}%</p>
            <p className="text-xs text-gray-500 mt-2">Charge moyenne CPU: {averageLoad}%</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Réseau moyen</p>
            <p className="text-lg font-bold text-indigo-600">⬇ {formatThroughput(averageNetIn)}</p>
            <p className="text-lg font-bold text-purple-600">⬆ {formatThroughput(averageNetOut)}</p>
            <p className="text-xs text-gray-500 mt-2">Uptime moyen: {formatUptime(averageUptime)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Services surveillés</p>
            <p className="text-3xl font-bold text-slate-700">{totalServices}</p>
            <p className="text-xs text-gray-500 mt-2">Avertissements: {servicesWarning} • Arrêtés: {servicesDown}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Incidents</p>
            <p className="text-3xl font-bold text-rose-600">{incidentCount}</p>
            <p className="text-xs text-gray-500 mt-2">Critiques: {criticalIncidents}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Dernier contrôle</p>
            <p className="text-2xl font-bold text-slate-700">
              {servers[0] ? new Date(servers[0].lastHealthCheck).toLocaleString('fr-FR') : '—'}
            </p>
          </div>
        </div>

        {/* Servers Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">État détaillé des serveurs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.length > 0 ? (
              servers.map((server) => {
                const cpuStatus = getThresholdStatus(server.metrics.cpuUsage, 70, 85);
                const ramStatus = getThresholdStatus(server.metrics.memoryUsage, 75, 90);
                const diskStatus = getThresholdStatus(server.metrics.diskUsage, 80, 90);
                const serviceStatus = getServiceStatus(server.services);
                const serverStatus = getServerStatus(server);
                const incidents = alerts
                  .filter((alert) => alert.source === server.name)
                  .slice(0, 3);
                const alertItems = [
                  cpuStatus !== 'normal'
                    ? { label: 'Surcharge CPU', status: cpuStatus }
                    : null,
                  diskStatus !== 'normal'
                    ? { label: 'Disque plein', status: diskStatus }
                    : null,
                  serviceStatus !== 'normal'
                    ? { label: 'Service indisponible', status: serviceStatus }
                    : null,
                ].filter(Boolean) as { label: string; status: 'normal' | 'attention' | 'critique' }[];

                return (
                  <div
                    key={server.id}
                    className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white/90 via-white/70 to-slate-50/80 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)] transition hover:shadow-[0_25px_70px_-35px_rgba(15,23,42,0.45)]"
                  >
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-100/40 blur-3xl" />
                    <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-indigo-100/40 blur-3xl" />

                    <div className="relative flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1">{server.status}</span>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(serverStatus)}`}>
                            {serverStatus}
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900">{server.name}</h3>
                        <p className="text-sm text-slate-500">{server.ipAddress}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(server.id)}
                          className="rounded-full border border-slate-200/70 bg-white/80 p-2 text-slate-600 hover:bg-slate-100"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(server.id)}
                          className={`rounded-full border border-slate-200/70 p-2 ${
                            server.id === 'local-pc'
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                              : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          }`}
                          title={server.id === 'local-pc' ? 'Serveur local non supprimable' : 'Supprimer'}
                          disabled={server.id === 'local-pc'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-xs text-slate-500">Santé</p>
                        <p className="text-2xl font-semibold text-slate-900">{server.healthScore}%</p>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500"
                            style={{ width: `${server.healthScore}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">Synthèse basée sur CPU, RAM, disque.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-xs text-slate-500">Uptime</p>
                        <p className="text-2xl font-semibold text-slate-900">{formatUptime(server.metrics.uptime)}</p>
                        <p className="text-xs text-slate-500 mt-1">{server.metrics.processCount} processus</p>
                        <p className="mt-1 text-[11px] text-slate-500">Temps depuis le dernier redémarrage.</p>
                      </div>
                    </div>

                    <div className="relative mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-xs text-slate-500">CPU</p>
                        <p className="text-lg font-semibold text-slate-900">{server.metrics.cpuUsage.toFixed(1)}%</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${statusDot(cpuStatus as any)}`} />
                          {cpuStatus}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">Charge processeur instantanée.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-xs text-slate-500">RAM</p>
                        <p className="text-lg font-semibold text-slate-900">{server.metrics.memoryUsage.toFixed(1)}%</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${statusDot(ramStatus as any)}`} />
                          {ramStatus}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">Mémoire utilisée sur le total.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-xs text-slate-500">Disque</p>
                        <p className="text-lg font-semibold text-slate-900">{server.metrics.diskUsage.toFixed(1)}%</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${statusDot(diskStatus as any)}`} />
                          {diskStatus}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">Occupation du stockage principal.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-xs text-slate-500">Réseau</p>
                        <p className="text-sm font-semibold text-slate-900">⬇ {formatThroughput(server.metrics.networkIn)}</p>
                        <p className="text-sm font-semibold text-slate-900">⬆ {formatThroughput(server.metrics.networkOut)}</p>
                        <p className="mt-2 text-[11px] text-slate-500">Débit entrant et sortant.</p>
                      </div>
                    </div>

                    <div className="relative mt-6 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-slate-500">État services</p>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${statusDot(serviceStatus as any)}`} />
                          {serviceStatus}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">Basé sur services actifs/arrêtés.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-slate-500">Alertes</p>
                        {alertItems.length === 0 ? (
                          <p className="mt-2 text-sm font-semibold text-slate-900">Aucune alerte</p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {alertItems.map((alertItem) => (
                              <div key={alertItem.label} className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusBadge(alertItem.status)}`}>
                                <span className={`h-2 w-2 rounded-full ${statusDot(alertItem.status)}`} />
                                {alertItem.label}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-[11px] text-slate-500">Déclenchées si seuil dépassé.</p>
                      </div>
                      <div className="col-span-2 rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <p className="text-slate-500">Historique incidents</p>
                        {incidents.length === 0 ? (
                          <p className="text-sm font-semibold text-slate-900">Aucun incident récent</p>
                        ) : (
                          <div className="mt-2 space-y-1 text-slate-700">
                            {incidents.map((incident) => (
                              <div key={incident.id}>• {incident.title}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Aucun serveur configuré</p>
                <p className="text-sm text-gray-400 mt-2">Ajoutez des serveurs depuis le tableau de bord</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
