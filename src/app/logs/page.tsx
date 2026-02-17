'use client';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { SystemLog, LogCategory, LogLevel } from '@/types';
import { Download, Trash2, Filter, Search, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LogsPage() {
  const { logs, setLogs, addLog, clearLogs } = useDashboardStore();
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<LogCategory | ''>('');
  const [filterLevel, setFilterLevel] = useState<LogLevel | ''>('');
  const [filterModule, setFilterModule] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [purgedays, setPurgeDays] = useState(30);

  const itemsPerPage = 50;

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterCategory) params.append('category', filterCategory);
        if (filterLevel) params.append('level', filterLevel);
        if (filterModule) params.append('module', filterModule);
        if (filterUsername) params.append('username', filterUsername);
        if (searchQuery) params.append('search', searchQuery);
        params.append('limit', itemsPerPage.toString());
        params.append('offset', ((page - 1) * itemsPerPage).toString());

        const res = await fetch(`/api/logs?${params}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.ok) {
          setLogs(data.logs);
          setTotalPages(data.pages);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filterCategory, filterLevel, filterModule, filterUsername, searchQuery, page, setLogs]);

  // Handle export
  const handleExport = () => {
    const csv = [
      ['Date', 'Catégorie', 'Niveau', 'Module', 'Utilisateur', 'Action', 'Objet', 'IP', 'Ancienne valeur', 'Nouvelle valeur'].join(','),
      ...logs.map((log) =>
        [
          new Date(log.timestamp).toISOString(),
          log.category,
          log.level,
          log.module,
          log.username || 'N/A',
          log.action,
          log.objectImpacted,
          log.ipSource || 'N/A',
          log.oldValue || 'N/A',
          log.newValue || 'N/A',
        ]
          .map((v) => `"${v}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Handle purge
  const handlePurge = async () => {
    if (!window.confirm(`Supprimer les logs plus anciens que ${purgedays} jours ?`)) return;

    try {
      const res = await fetch(`/api/logs?action=purge-old&days=${purgedays}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        alert(`${data.removed} anciens logs supprimés`);
        setPage(1);
        // Refetch
        const resLogs = await fetch(`/api/logs?limit=${itemsPerPage}`, { cache: 'no-store' });
        const logsData = await resLogs.json();
        if (logsData.ok) setLogs(logsData.logs);
      }
    } catch (error) {
      console.error('Purge failed:', error);
    }
  };

  // Get log stats
  const stats = {
    total: logs.length,
    system: logs.filter((l) => l.category === 'system').length,
    user: logs.filter((l) => l.category === 'user').length,
    action: logs.filter((l) => l.category === 'action').length,
    security: logs.filter((l) => l.category === 'security').length,
    critical: logs.filter((l) => l.level === 'critical').length,
    error: logs.filter((l) => l.level === 'error').length,
  };

  // Get unique modules and users
  const modules = [...new Set(logs.map((l) => l.module))];
  const users = [...new Set(logs.map((l) => l.username).filter(Boolean))];

  const levelColors = {
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    error: 'bg-red-100 text-red-800 border-red-300',
    critical: 'bg-red-200 text-red-900 border-red-400',
  };

  const categoryIcons = {
    system: '⚙️',
    user: '👤',
    action: '📝',
    security: '🔒',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900">Gestion des logs</h1>
            <p className="text-gray-600 mt-2">Centralisez et consultez tous les journaux système, utilisateurs, actions et sécurité</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/logs/test"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-colors"
            >
              🧪 Test Logs
            </a>
            <a
              href="/logs/stats"
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Statistiques
            </a>
            <a
              href="/logs/integration-guide"
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm transition-colors"
            >
              📚 Intégration
            </a>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Système</p>
            <p className="text-2xl font-bold text-gray-600">{stats.system}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Utilisateur</p>
            <p className="text-2xl font-bold text-gray-600">{stats.user}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Action</p>
            <p className="text-2xl font-bold text-gray-600">{stats.action}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Sécurité</p>
            <p className="text-2xl font-bold text-purple-600">{stats.security}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Erreurs</p>
            <p className="text-2xl font-bold text-red-600">{stats.error}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">Critique</p>
            <p className="text-2xl font-bold text-red-700">{stats.critical}</p>
          </div>
        </div>

        {/* Filters & Export */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Filter size={18} /> Filtres et recherche
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-100 text-green-700 text-sm font-medium hover:bg-green-200"
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                onClick={handlePurge}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200"
              >
                <Trash2 size={16} /> Purger
              </button>
            </div>
          </div>

          {/* Filter Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Catégorie</label>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value as any); setPage(1); }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes</option>
                <option value="system">Système</option>
                <option value="user">Utilisateur</option>
                <option value="action">Action</option>
                <option value="security">Sécurité</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Niveau</label>
              <select
                value={filterLevel}
                onChange={(e) => { setFilterLevel(e.target.value as any); setPage(1); }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                <option value="info">Info</option>
                <option value="warning">Avertissement</option>
                <option value="error">Erreur</option>
                <option value="critical">Critique</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Module</label>
              <select
                value={filterModule}
                onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                {modules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Utilisateur</label>
              <select
                value={filterUsername}
                onChange={(e) => { setFilterUsername(e.target.value); setPage(1); }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Jours à conserver</label>
              <input
                type="number"
                value={purgedays}
                onChange={(e) => setPurgeDays(parseInt(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Recherche (action, objet, module)</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Chercher..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Chargement des logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Aucun log disponible</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Date</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Cat.</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Niveau</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Module</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Action</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Objet</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">Utilisateur</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <span className="text-lg">{categoryIcons[log.category] || '📋'}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded border ${levelColors[log.level]}`}>
                            {log.level}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-gray-900">{log.module}</td>
                        <td className="px-4 py-2 text-xs text-gray-700">{log.action}</td>
                        <td className="px-4 py-2 text-xs text-gray-700 max-w-xs truncate">{log.objectImpacted}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{log.username || 'N/A'}</td>
                        <td className="px-4 py-2 text-xs text-gray-600 font-mono">{log.ipSource || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                <span className="text-xs text-gray-600">
                  Page {page} sur {totalPages} ({stats.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
