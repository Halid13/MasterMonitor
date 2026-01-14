'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import StatCard from '@/components/StatCard';
import AlertItem from '@/components/AlertItem';
import ServerCard from '@/components/ServerCard';
import TicketCard from '@/components/TicketCard';
import { useDashboardStore } from '@/store/dashboard';
import { DashboardStats, Alert, ServerStatus, Ticket } from '@/types';
import { TrendingUp, AlertCircle, Zap } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    alerts,
    servers,
    tickets,
    resolveAlert,
  } = useDashboardStore();

  // Mock data for demonstration
  useEffect(() => {
    // Simulated API call with mock data
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

    const mockServers: ServerStatus[] = [
      {
        id: '1',
        name: 'Serveur Principal',
        ipAddress: '192.168.1.10',
        status: 'online',
        healthScore: 92,
        metrics: {
          id: '1',
          serverId: '1',
          cpuUsage: 35,
          memoryUsage: 62,
          diskUsage: 45,
          networkIn: 1024,
          networkOut: 512,
          processCount: 128,
          uptime: 432000,
          timestamp: new Date(),
        },
        lastHealthCheck: new Date(),
        services: [
          { id: '1', name: 'Apache', status: 'running', port: 80 },
          { id: '2', name: 'MySQL', status: 'running', port: 3306 },
        ],
      },
      {
        id: '2',
        name: 'Serveur Backup',
        ipAddress: '192.168.1.11',
        status: 'online',
        healthScore: 78,
        metrics: {
          id: '2',
          serverId: '2',
          cpuUsage: 28,
          memoryUsage: 55,
          diskUsage: 60,
          networkIn: 512,
          networkOut: 256,
          processCount: 95,
          uptime: 432000,
          timestamp: new Date(),
        },
        lastHealthCheck: new Date(),
        services: [
          { id: '3', name: 'Backup Service', status: 'running', port: 8080 },
        ],
      },
    ];

    const mockAlerts: Alert[] = [
      {
        id: '1',
        title: 'Disque presque plein',
        message: 'Serveur Principal: Utilisation disque à 85%',
        type: 'warning',
        source: 'Serveur Principal',
        isResolved: false,
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        id: '2',
        title: 'Service arrêté',
        message: 'Redis service est arrêté sur le serveur de cache',
        type: 'critical',
        source: 'Serveur Cache',
        isResolved: false,
        createdAt: new Date(Date.now() - 1800000),
      },
    ];

    const mockTickets: Ticket[] = [
      {
        id: '1',
        title: 'Imprimante ne répond pas',
        description: 'Imprimante réseau au 3ème étage ne répond plus',
        priority: 'high',
        status: 'in-progress',
        category: 'hardware',
        createdBy: 'Jean Dupont',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 3600000),
        comments: [],
      },
      {
        id: '2',
        title: 'Accès VPN défaillant',
        description: 'Plusieurs utilisateurs signalent une connexion VPN instable',
        priority: 'high',
        status: 'in-progress',
        category: 'network',
        createdBy: 'Marie Martin',
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(Date.now() - 7200000),
        comments: [],
      },
    ];

    setStats(mockStats);
    useDashboardStore.setState({
      servers: mockServers,
      alerts: mockAlerts,
      tickets: mockTickets,
    });

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-600 mt-2">Bienvenue! Voici un aperçu de votre infrastructure IT</p>
        </div>

        {/* Stats Grid */}
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

        {/* Health Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    <span className="font-bold text-lg">{stats.serverHealthScore}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600"
                      style={{ width: `${stats.serverHealthScore}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Utilisation des IPs</h3>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            {stats && (
              <>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Allocation</span>
                    <span className="font-bold text-lg">{stats.ipUtilization}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                      style={{ width: `${stats.ipUtilization}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Alertes actives</h3>
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            {stats && (
              <>
                <p className="text-3xl font-bold text-red-600">{stats.activeAlerts}</p>
                <p className="text-sm text-gray-600 mt-2">Nécessitant une action</p>
              </>
            )}
          </div>
        </div>

        {/* Servers Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">État des serveurs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.length > 0 ? (
              servers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))
            ) : (
              <p className="text-gray-500">Aucun serveur configuré</p>
            )}
          </div>
        </div>

        {/* Alerts Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Alertes récentes</h2>
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onResolve={resolveAlert}
                />
              ))
            ) : (
              <p className="text-gray-500">Aucune alerte</p>
            )}
          </div>
        </div>

        {/* Tickets Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Tickets Helpdesk récents</h2>
            <a href="/tickets" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              Voir tous →
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tickets.slice(0, 4).length > 0 ? (
              tickets.slice(0, 4).map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))
            ) : (
              <p className="text-gray-500">Aucun ticket</p>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
