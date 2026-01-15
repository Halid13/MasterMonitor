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
import { TrendingUp, AlertCircle, Zap } from 'lucide-react';

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
      <div className="space-y-6">
        {/* Titre */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Tableau de bord</h1>
            <p className="text-gray-600 mt-1">Suivi en temps réel de votre infrastructure IT</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Mis à jour en direct</p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-600">En ligne</span>
            </div>
          </div>
        </div>

        {/* KPIs en haut */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Équipements opérationnels"
              value={`${stats.operationalEquipment}/${stats.totalEquipment}`}
              icon="💻"
              color="green"
            />
            <StatCard
              title="Utilisateurs actifs"
              value={`${stats.activeUsers}/${stats.totalUsers}`}
              icon="👥"
              color="blue"
            />
            <StatCard
              title="Tickets ouverts"
              value={stats.openTickets}
              icon="🎫"
              trend={-12}
              color="yellow"
            />
            <StatCard
              title="Alertes critiques"
              value={stats.criticalTickets}
              icon="⚠️"
              color={stats.criticalTickets > 0 ? 'red' : 'green'}
            />
          </div>
        )}

        {/* Graphiques principaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU, Mémoire, Disque */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Métriques système</h2>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Temps réel</span>
            </div>
            <MetricsLineChart data={timeSeriesData} />
          </div>

          {/* Charge serveur */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Charge moyenne</h2>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <ServerLoadChart data={timeSeriesData} />
          </div>
        </div>

        {/* Graphiques secondaires */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tickets par jour */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tickets par jour</h2>
            <TicketsBarChart data={ticketsData} />
          </div>

          {/* Statut équipements */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Statut des équipements</h2>
            <StatusPieChart data={equipmentStatus} />
          </div>
        </div>

        {/* Trafic réseau */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Trafic réseau</h2>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Entrée/Sortie</span>
          </div>
          <NetworkTrafficChart data={timeSeriesData} />
        </div>

        {/* Grille d'informations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Santé des serveurs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Santé des serveurs</h3>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            {stats && (
              <>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Score global</span>
                    <span className="font-bold text-2xl text-blue-600">{stats.serverHealthScore}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                      style={{ width: `${stats.serverHealthScore}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Utilisation des IPs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Allocation IPs</h3>
              <span className="text-2xl">🌐</span>
            </div>
            {stats && (
              <>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Utilisation</span>
                    <span className="font-bold text-2xl text-purple-600">{stats.ipUtilization}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-500"
                      style={{ width: `${stats.ipUtilization}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Alertes actives */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Alertes</h3>
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            {stats && (
              <>
                <p className="text-4xl font-bold text-red-600 mb-2">{stats.activeAlerts}</p>
                <p className="text-sm text-gray-600">Alertes actives nécessitant attention</p>
              </>
            )}
          </div>
        </div>

        {/* Serveurs et alertes en bas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Statut serveurs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">État des serveurs</h3>
            <div className="space-y-3">
              {servers.map((server) => (
                <div key={server.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{server.name}</p>
                    <p className="text-xs text-gray-500">{server.ipAddress}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-600"
                        style={{ width: `${server.healthScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-8">{server.healthScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes récentes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Alertes récentes</h3>
            <div className="space-y-3">
              {alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded border-l-4 ${
                    alert.type === 'critical'
                      ? 'bg-red-50 border-red-500'
                      : alert.type === 'error'
                      ? 'bg-red-50 border-red-500'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">{alert.title}</p>
                  <p className="text-xs text-gray-600">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

