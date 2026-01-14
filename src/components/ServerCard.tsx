'use client';


import { ServerStatus } from '@/types';
import { Activity, AlertCircle } from 'lucide-react';

interface ServerCardProps {
  server: ServerStatus;
}

export const ServerCard: React.FC<ServerCardProps> = ({ server }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-50';
      case 'offline':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900">{server.name}</h3>
          <p className="text-sm text-gray-500">{server.ipAddress}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(server.status)}`}>
          {server.status === 'online' && <Activity className="w-4 h-4 inline mr-1" />}
          {server.status === 'offline' && <AlertCircle className="w-4 h-4 inline mr-1" />}
          {server.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Santé</span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${getHealthColor(server.healthScore)}`} style={{ width: `${server.healthScore}%` }} />
            </div>
            <span className="text-sm font-semibold">{server.healthScore}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">CPU</span>
            <p className="font-semibold">{server.metrics.cpuUsage.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-gray-600">RAM</span>
            <p className="font-semibold">{server.metrics.memoryUsage.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-gray-600">Disque</span>
            <p className="font-semibold">{server.metrics.diskUsage.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-gray-600">Uptime</span>
            <p className="font-semibold">{(server.metrics.uptime / 3600).toFixed(1)}h</p>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Dernière vérification: {new Date(server.lastHealthCheck).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ServerCard;
