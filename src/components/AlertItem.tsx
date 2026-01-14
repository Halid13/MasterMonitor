'use client';

import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Alert } from '@/types';

interface AlertItemProps {
  alert: Alert;
  onResolve?: (id: string) => void;
}

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const getIcon = () => {
    switch (alert.type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (alert.type) {
      case 'critical':
      case 'error':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-500';
      case 'info':
        return 'bg-blue-50 border-l-4 border-blue-500';
      default:
        return 'bg-gray-50 border-l-4 border-gray-500';
    }
  };

  return (
    <div className={`p-4 rounded ${getBgColor()} flex items-start justify-between`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div>
          <h3 className="font-semibold text-gray-900">{alert.title}</h3>
          <p className="text-sm text-gray-600">{alert.message}</p>
          <p className="text-xs text-gray-500 mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
        </div>
      </div>
      {!alert.isResolved && onResolve && (
        <button
          onClick={() => onResolve(alert.id)}
          className="ml-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          Résoudre
        </button>
      )}
      {alert.isResolved && <CheckCircle className="w-5 h-5 text-green-500" />}
    </div>
  );
};

export default AlertItem;
