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

// Générer des données de temps réel
const generateTimeSeriesData = (hours: number = 24) => {
  const data = [];
  const now = new Date();
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000);
    data.push({
      time: time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      load: Math.random() * 100,
      incoming: Math.random() * 1000,
      outgoing: Math.random() * 1000,
    });
  }
  return data;
};

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

  const { alerts, servers } = useDashboardStore();

  useEffect(() => {
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
      serverHealthScore: 87,
      ipUtilization: 73,
      activeAlerts: 5,
    };

    setStats(mockStats);
    setTimeSeriesData(generateTimeSeriesData(24));
    setTicketsData(generateTicketsData());
    setEquipmentStatus(generateEquipmentStatus());
    setLoading(false);
  }, []);

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
            <h3 className="font-bold text-slate-900 text-sm mb-4">Santé serveurs</h3>
            {stats && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600">Score global</span>
                  <span className="font-bold text-2xl text-blue-600">{stats.serverHealthScore}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-500"
                    style={{ width: `${stats.serverHealthScore}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-purple-50/80 via-white/60 to-purple-50/40 backdrop-blur-sm border border-purple-200/40 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Allocation IPs</h3>
            {stats && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600">Utilisation</span>
                  <span className="font-bold text-2xl text-purple-600">{stats.ipUtilization}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-500"
                    style={{ width: `${stats.ipUtilization}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-red-50/80 via-white/60 to-red-50/40 backdrop-blur-sm border border-red-200/40 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Alertes</h3>
            {stats && (
              <div>
                <p className="text-3xl font-bold text-red-600 mb-1">{stats.activeAlerts}</p>
                <p className="text-xs text-slate-600">Alertes actives</p>
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
              {servers.slice(0, 3).map((server) => (
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
              {alerts.slice(0, 3).map((alert) => (
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
