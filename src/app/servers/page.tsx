'use client';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

export default function ServersPage() {
  const { servers, alerts, addServer } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', ipAddress: '' });

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

    addServer({
      id: Date.now().toString(),
      name: formData.name.trim(),
      ipAddress: formData.ipAddress.trim(),
      status: 'online',
      healthScore: 100,
      metrics: {
        id: `${Date.now()}-metrics`,
        serverId: Date.now().toString(),
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

    setFormData({ name: '', ipAddress: '' });
    setShowModal(false);
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
                <h2 className="text-lg font-bold text-gray-900">Ajouter un serveur</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
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

                return (
                  <div key={server.id} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{server.name}</h3>
                        <p className="text-sm text-gray-500">{server.ipAddress}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(serverStatus)}`}>
                        {serverStatus}
                      </span>
                    </div>

                    {/* Surveillance */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Surveillance</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>Disponibilité</span>
                          <span className={`text-xs font-semibold ${statusBadge(server.status === 'offline' ? 'critique' : 'normal')}`}>
                            {server.status === 'offline' ? 'critique' : 'normal'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>CPU</span>
                          <span className={`text-xs font-semibold ${statusBadge(cpuStatus as any)}`}>{cpuStatus}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>RAM</span>
                          <span className={`text-xs font-semibold ${statusBadge(ramStatus as any)}`}>{ramStatus}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>Disque</span>
                          <span className={`text-xs font-semibold ${statusBadge(diskStatus as any)}`}>{diskStatus}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>État services</span>
                          <span className={`text-xs font-semibold ${statusBadge(serviceStatus as any)}`}>{serviceStatus}</span>
                        </div>
                      </div>
                    </div>

                    {/* Informations affichées */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Informations affichées</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Statut serveur</p>
                          <p className="font-semibold text-gray-800">{server.status}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Adresse réseau</p>
                          <p className="font-semibold text-gray-800">{server.ipAddress}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Masque</p>
                          <p className="font-semibold text-gray-800">—</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Historique incidents</p>
                          <p className="font-semibold text-gray-800">{incidents.length} incident(s)</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Processus</p>
                          <p className="font-semibold text-gray-800">{server.metrics.processCount}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Uptime</p>
                          <p className="font-semibold text-gray-800">{formatUptime(server.metrics.uptime)}</p>
                        </div>
                      </div>
                      {incidents.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {incidents.map((incident) => (
                            <div key={incident.id} className="text-xs text-gray-600">
                              • {incident.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Alertes */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Alertes</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>Surcharge CPU</span>
                          <span className={`text-xs font-semibold ${statusBadge(cpuStatus as any)}`}>{cpuStatus}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>Disque plein</span>
                          <span className={`text-xs font-semibold ${statusBadge(diskStatus as any)}`}>{diskStatus}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <span>Service indisponible</span>
                          <span className={`text-xs font-semibold ${statusBadge(serviceStatus as any)}`}>{serviceStatus}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">Affichage par statut : normal, attention, critique.</div>
                    </div>

                    {/* Détails techniques */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Détails techniques</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">CPU</p>
                          <p className="font-semibold text-gray-800">{server.metrics.cpuUsage.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">RAM</p>
                          <p className="font-semibold text-gray-800">{server.metrics.memoryUsage.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Disque</p>
                          <p className="font-semibold text-gray-800">{server.metrics.diskUsage.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Réseau</p>
                          <p className="font-semibold text-gray-800">⬇ {formatThroughput(server.metrics.networkIn)} / ⬆ {formatThroughput(server.metrics.networkOut)}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Dernière vérif.</p>
                          <p className="font-semibold text-gray-800">{new Date(server.lastHealthCheck).toLocaleString('fr-FR')}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500">Santé</p>
                          <p className="font-semibold text-gray-800">{server.healthScore}%</p>
                        </div>
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
