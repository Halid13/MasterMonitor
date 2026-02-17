'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import StatCard from '@/components/StatCard';

import {
  MetricsLineChart,
  ServerLoadChart,
  TicketsBarChart,
  StatusPieChart,
  NetworkTrafficChart,
} from '@/components/ChartComponents';
import { useDashboardStore } from '@/store/dashboard';
import { DashboardStats } from '@/types';

const generateTicketsData = () => [
  { name: 'Lun', open: 12, inProgress: 8, closed: 15 },
  { name: 'Mar', open: 10, inProgress: 12, closed: 18 },
  { name: 'Mer', open: 15, inProgress: 10, closed: 12 },
  { name: 'Jeu', open: 8, inProgress: 14, closed: 20 },
  { name: 'Ven', open: 18, inProgress: 9, closed: 22 },
  { name: 'Sam', open: 5, inProgress: 3, closed: 10 },
  { name: 'Dim', open: 3, inProgress: 2, closed: 8 },
];

const generateEquipmentStatus = () => [
  { name: 'Opérationnel', value: 145, color: '#10b981' },
  { name: 'Maintenance', value: 8, color: '#f59e0b' },
  { name: 'Hors ligne', value: 3, color: '#ef4444' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [ticketsData, setTicketsData] = useState<any[]>([]);
  const [equipmentStatus, setEquipmentStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMetrics, setLiveMetrics] = useState<{ cpu: number; memory: number; disk: number | null; load: number } | null>(null);

  const { alerts, servers } = useDashboardStore();

  useEffect(() => {
    let isMounted = true;

    // Données de démonstration
    const mockStats: DashboardStats = {
      totalEquipment: 156,
      operationalEquipment: 148,
      offlineEquipment: 8,
      totalUsers: 342,
      activeUsers: 287,
      totalTickets: 124,
      openTickets: 34,
      criticalTickets: 3,
      serverHealthScore: 0,
      ipUtilization: 73,
      activeAlerts: 5,
    };

    const pushMetricPoint = (metric: any) => {
      const now = new Date();
      const point = {
        time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        cpu: metric?.cpu ?? 0,
        memory: metric?.memory ?? 0,
        disk: metric?.disk ?? 0,
        load: metric?.load ?? 0,
        incoming: metric?.network?.incoming ?? 0,
        outgoing: metric?.network?.outgoing ?? 0,
      };
      setTimeSeriesData((prev) => [...prev, point].slice(-24));
      setLiveMetrics({
        cpu: metric?.cpu ?? 0,
        memory: metric?.memory ?? 0,
        disk: metric?.disk ?? null,
        load: metric?.load ?? 0,
      });
    };

    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/system/metrics', { cache: 'no-store' });
        const data = await res.json();
        if (!isMounted || !data?.ok) return;
        pushMetricPoint(data);
        setLoading(false);
      } catch {
        if (isMounted) setLoading(false);
      }
    };

    setStats(mockStats);
    setTicketsData(generateTicketsData());
    setEquipmentStatus(generateEquipmentStatus());
    fetchMetrics();

    const timer = setInterval(fetchMetrics, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const getHealthScore = () => {
    if (!liveMetrics) return stats?.serverHealthScore ?? 0;
    const cpu = Math.min(100, Math.max(0, liveMetrics.cpu));
    const memory = Math.min(100, Math.max(0, liveMetrics.memory));
    const load = Math.min(100, Math.max(0, liveMetrics.load));
    const diskValue = liveMetrics.disk == null ? 0 : Math.min(100, Math.max(0, liveMetrics.disk));

    const cpuScore = 100 - cpu;
    const memScore = 100 - memory;
    const diskScore = 100 - diskValue;
    const loadScore = 100 - load;

    const avg = cpuScore * 0.35 + memScore * 0.35 + diskScore * 0.2 + loadScore * 0.1;
    return Math.round(Math.max(0, Math.min(100, avg)));
  };

  const healthScore = getHealthScore();
  const onlineCount = servers.filter((s) => s.status === 'online').length;
  const availability = servers.length > 0
    ? Math.round((onlineCount / servers.length) * 100)
    : 0;
  const resolvedTicketRate = stats && stats.totalTickets > 0
    ? Math.round(((stats.totalTickets - stats.openTickets) / stats.totalTickets) * 100)
    : 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement du dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">Tableau de bord</h1>
            <p className="text-slate-600 mt-2 text-sm">Suivi en temps réel de votre infrastructure IT</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/40 rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-emerald-700">En ligne</span>
          </div>
        </div>

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Équipements"
              value={`${stats.operationalEquipment}/${stats.totalEquipment}`}
              icon="💻"
              color="green"
            />
            <StatCard
              title="Utilisateurs"
              value={`${stats.activeUsers}/${stats.totalUsers}`}
              icon="👥"
              color="blue"
            />
            <StatCard
              title="Tickets ouverts"
              value={stats.openTickets}
              icon="🎫"
              color="yellow"
            />
            <StatCard
              title="Alertes"
              value={stats.criticalTickets}
              icon="⚠️"
              color={stats.criticalTickets > 0 ? 'red' : 'green'}
            />
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Métriques système</h2>
            <MetricsLineChart data={timeSeriesData} />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Charge serveur</h2>
            <ServerLoadChart data={timeSeriesData} />
          </div>
        </div>

        {/* Secondary Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tickets par jour</h2>
            <TicketsBarChart data={ticketsData} />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Statut équipements</h2>
            <StatusPieChart data={equipmentStatus} />
          </div>
        </div>

        {/* Network Traffic */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Trafic réseau</h2>
          <NetworkTrafficChart data={timeSeriesData} />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50/80 via-white/60 to-blue-50/40 backdrop-blur-sm border border-blue-200/40 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Santé serveurs</h3>
              <div className="group relative">
                <button className="text-slate-400 hover:text-slate-600 text-xs">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="hidden group-hover:block absolute right-0 top-6 w-72 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-lg z-10">
                  <p className="font-semibold mb-2">Calcul de la santé globale :</p>
                  <ul className="space-y-1">
                    <li>• <span className="text-blue-300">CPU (35%)</span> : Utilisation processeur</li>
                    <li>• <span className="text-blue-300">RAM (35%)</span> : Utilisation mémoire</li>
                    <li>• <span className="text-blue-300">Disque (20%)</span> : Espace disque utilisé</li>
                    <li>• <span className="text-blue-300">Charge (10%)</span> : Load average</li>
                  </ul>
                  <div className="mt-2 pt-2 border-t border-slate-600">
                    <p className="text-emerald-300">✓ 80-100% : Normal</p>
                    <p className="text-yellow-300">⚠ 60-79% : Attention</p>
                    <p className="text-red-300">✗ 0-59% : Critique</p>
                  </div>
                </div>
              </div>
            </div>
            {stats && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600">Score global</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-2xl text-blue-600">{healthScore}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      healthScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                      healthScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {healthScore >= 80 ? 'Optimal' : healthScore >= 60 ? 'Attention' : 'Critique'}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      healthScore >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                      healthScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                      'bg-gradient-to-r from-red-400 to-red-500'
                    }`}
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {healthScore >= 80 ? 'Tous les systèmes fonctionnent normalement' :
                   healthScore >= 60 ? 'Surveillance recommandée, ressources limitées' :
                   'Intervention requise, performances dégradées'}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-purple-50/80 via-white/60 to-purple-50/40 backdrop-blur-sm border border-purple-200/40 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Disponibilité serveurs</h3>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-600">En ligne</span>
                <span className="font-bold text-2xl text-purple-600">{availability}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-purple-500"
                  style={{ width: `${availability}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {onlineCount} en ligne sur {servers.length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white/60 to-emerald-50/40 backdrop-blur-sm border border-emerald-200/40 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Taux de résolution</h3>
            {stats && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600">Résolus</span>
                  <span className="font-bold text-2xl text-emerald-600">{resolvedTicketRate}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                    style={{ width: `${resolvedTicketRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {stats.totalTickets - stats.openTickets} résolus sur {stats.totalTickets}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Servers */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">État des serveurs</h3>
            <div className="space-y-2">
              {servers.slice(0, 3).map((server: any) => (
                <div key={server.id} className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/40 rounded-lg hover:bg-white/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{server.name}</p>
                    <p className="text-xs text-slate-500">{server.ipAddress}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${server.healthScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-6">{server.healthScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-50/40 backdrop-blur-sm border border-slate-200/40 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Alertes récentes</h3>
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert: any) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg text-xs border-l-2 backdrop-blur-sm ${
                    alert.type === 'critical'
                      ? 'bg-red-50/80 border-l-red-500 text-red-900'
                      : alert.type === 'error'
                      ? 'bg-orange-50/80 border-l-orange-500 text-orange-900'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50/80 border-l-yellow-500 text-yellow-900'
                      : 'bg-blue-50/80 border-l-blue-500 text-blue-900'
                  }`}
                >
                  <p className="font-medium">{alert.title}</p>
                  <p className="opacity-80 mt-0.5">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
