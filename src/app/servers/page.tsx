'use client';
import MainLayout from '@/components/MainLayout';
import ServerCard from '@/components/ServerCard';
import { useDashboardStore } from '@/store/dashboard';

export default function ServersPage() {
  const { servers } = useDashboardStore();

  const averageHealth = servers.length > 0
    ? Math.round(servers.reduce((sum, s) => sum + s.healthScore, 0) / servers.length)
    : 0;

  const averageCPU = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.cpuUsage, 0) / servers.length).toFixed(1)
    : 0;

  const averageMemory = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.metrics.memoryUsage, 0) / servers.length).toFixed(1)
    : 0;

  const onlineCount = servers.filter(s => s.status === 'online').length;
  const offlineCount = servers.filter(s => s.status === 'offline').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supervision des serveurs</h1>
          <p className="text-gray-600 mt-2">État et métriques de tous vos serveurs</p>
        </div>

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

        {/* Servers Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">État détaillé des serveurs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.length > 0 ? (
              servers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))
            ) : (
              <div className="col-span-full bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Aucun serveur configuré</p>
                <p className="text-sm text-gray-400 mt-2">Ajoutez des serveurs depuis le tableau de bord</p>
              </div>
            )}
          </div>
        </div>

        {/* Services Status */}
        {servers.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">État des services</h2>
            <div className="space-y-4">
              {servers.map((server) => (
                <div key={server.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <h3 className="font-semibold text-gray-900 mb-3">{server.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {server.services.map((service) => (
                      <div key={service.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="font-medium text-gray-900">{service.name}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          service.status === 'running'
                            ? 'bg-green-100 text-green-800'
                            : service.status === 'warning'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {service.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
