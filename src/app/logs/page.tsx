'use client';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { SystemLog, LogCategory, LogLevel } from '@/types';
import { Activity, AlertTriangle, TrendingUp, Shield, Download, Trash2, Filter, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function LogsPage() {
  const { logs, setLogs } = useDashboardStore();
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<LogCategory | ''>('');
  const [filterLevel, setFilterLevel] = useState<LogLevel | ''>('');
  const [filterModule, setFilterModule] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [purgedays, setPurgeDays] = useState(30);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState('');
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  const itemsPerPage = 50;
  const logsRef = useRef<SystemLog[]>([]);

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

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const matchesCurrentFilters = (log: SystemLog) => {
    if (filterCategory && log.category !== filterCategory) return false;
    if (filterLevel && log.level !== filterLevel) return false;
    if (filterModule && !log.module.toLowerCase().includes(filterModule.toLowerCase())) return false;
    if (filterUsername && !(log.username || '').toLowerCase().includes(filterUsername.toLowerCase())) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        log.action,
        log.objectImpacted,
        log.module,
        log.username || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  useEffect(() => {
    if (page !== 1) return;

    const params = new URLSearchParams();
    if (filterCategory) params.append('category', filterCategory);
    if (filterLevel) params.append('level', filterLevel);
    if (filterModule) params.append('module', filterModule);
    if (filterUsername) params.append('username', filterUsername);
    if (searchQuery) params.append('search', searchQuery);

    const source = new EventSource(`/api/logs/stream?${params.toString()}`);

    const onLog = (event: MessageEvent) => {
      try {
        const log = JSON.parse(event.data) as SystemLog;
        if (!matchesCurrentFilters(log)) return;
        const current = logsRef.current;
        if (current.some((l) => l.id === log.id)) return;
        const next = [log, ...current].slice(0, itemsPerPage);
        setLogs(next);
      } catch (error) {
        console.error('Failed to parse log stream event:', error);
      }
    };

    source.addEventListener('log', onLog as EventListener);

    return () => {
      source.removeEventListener('log', onLog as EventListener);
      source.close();
    };
  }, [filterCategory, filterLevel, filterModule, filterUsername, searchQuery, page, setLogs]);

  // Handle export
  const handleExport = async () => {
    const XLSX = await import('xlsx');

    const headers = ['Date', 'Catégorie', 'Niveau', 'Module', 'Utilisateur', 'Action', 'Objet', 'IP', 'Ancienne valeur', 'Nouvelle valeur'];
    const rows = logs.map((log) => [
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
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 14 },
      { wch: 12 },
      { wch: 18 },
      { wch: 22 },
      { wch: 28 },
      { wch: 30 },
      { wch: 18 },
      { wch: 30 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Logs');
    XLSX.writeFile(workbook, `logs-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Handle purge
  const confirmPurge = async () => {
    const days = Number(purgedays);
    if (!Number.isFinite(days) || days < 1) {
      setPurgeMessage('Veuillez saisir un nombre de jours valide.');
      return;
    }

    setPurgeLoading(true);
    setPurgeMessage('');
    try {
      const res = await fetch(`/api/logs?action=purge-old&days=${days}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPurgeMessage(data?.error || 'Échec de la purge des logs.');
        return;
      }

      setPurgeMessage(`${data.removed} anciens logs supprimés avec succès.`);
      setPage(1);

      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      if (filterLevel) params.append('level', filterLevel);
      if (filterModule) params.append('module', filterModule);
      if (filterUsername) params.append('username', filterUsername);
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', itemsPerPage.toString());
      params.append('offset', '0');

      const resLogs = await fetch(`/api/logs?${params}`, { cache: 'no-store' });
      const logsData = await resLogs.json();
      if (logsData.ok) {
        setLogs(logsData.logs);
        setTotalPages(logsData.pages);
      }

      setTimeout(() => {
        setShowPurgeModal(false);
        setPurgeMessage('');
      }, 1500);
    } catch (error) {
      console.error('Purge failed:', error);
      setPurgeMessage('Erreur réseau lors de la purge des logs.');
    } finally {
      setPurgeLoading(false);
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
    warning: logs.filter((l) => l.level === 'warning').length,
  };

  const systemPercent = stats.total > 0 ? Number(((stats.system / stats.total) * 100).toFixed(1)) : 0;
  const userPercent = stats.total > 0 ? Number(((stats.user / stats.total) * 100).toFixed(1)) : 0;
  const actionPercent = stats.total > 0 ? Number(((stats.action / stats.total) * 100).toFixed(1)) : 0;
  const securityPercent = stats.total > 0 ? Number(((stats.security / stats.total) * 100).toFixed(1)) : 0;

  // Get unique modules and users
  const modules = [...new Set(logs.map((l) => l.module))];
  const users = [...new Set(logs.map((l) => l.username).filter(Boolean))];

  const levelColors = {
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    error: 'bg-red-100 text-red-800 border-red-300',
    critical: 'bg-red-200 text-red-900 border-red-400',
  };

  const categoryLabels = {
    system: 'Système',
    user: 'Utilisateur',
    action: 'Action',
    security: 'Sécurité',
  };
  const categoryPills = {
    system: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    user: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    action: 'bg-purple-50 text-purple-700 border-purple-200',
    security: 'bg-red-50 text-red-700 border-red-200',
  };
  const categoryDots = {
    system: 'bg-cyan-500',
    user: 'bg-yellow-500',
    action: 'bg-purple-500',
    security: 'bg-red-500',
  };


  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des logs</h1>
            <p className="text-gray-600 mt-2">Centralisez et consultez tous les journaux système, utilisateurs, actions et sécurité</p>
          </div>
          <div />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 backdrop-blur-sm border border-blue-100/70 shadow-sm p-3 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold text-sm">Total des Logs</h3>
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-[10px] text-slate-500 mt-1">Tous les logs</p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-red-50/80 via-white to-rose-50/40 backdrop-blur-sm border border-red-100/70 shadow-sm p-3 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold text-sm">Événements Critiques</h3>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-[10px] text-slate-500 mt-1">Urgent</p>
          </div>

          <div className="rounded-xl bg-white/70 backdrop-blur-sm border border-slate-200/40 shadow-sm p-3 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold text-sm">Erreurs</h3>
              <TrendingUp className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.error}</div>
            <p className="text-[10px] text-slate-500 mt-1">À surveiller</p>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-orange-50/80 via-white to-amber-50/40 backdrop-blur-sm border border-orange-100/70 shadow-sm p-3 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold text-sm">Avertissements</h3>
              <Shield className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-orange-600">{stats.warning}</div>
            <p className="text-[10px] text-slate-500 mt-1">À surveiller</p>
          </div>
        </div>

        {/* Répartition par Catégorie */}
        <div className="rounded-xl bg-gradient-to-br from-white/80 via-white/70 to-slate-50/80 backdrop-blur-sm border border-slate-200/40 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Répartition par Catégorie</h2>
              <p className="text-xs text-slate-500">Vue synthétique par catégorie</p>
            </div>
            <span className="text-[11px] text-slate-500">Total: {stats.total}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200/60 bg-white/80 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚙️</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Système</p>
                    <p className="text-[11px] text-slate-500">Métriques, health checks</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-cyan-600">{stats.system}</p>
                  <p className="text-[11px] text-slate-500">{systemPercent}%</p>
                </div>
              </div>
              <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${systemPercent}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/60 bg-white/80 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👤</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Utilisateur</p>
                    <p className="text-[11px] text-slate-500">Sessions, authentification</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-yellow-600">{stats.user}</p>
                  <p className="text-[11px] text-slate-500">{userPercent}%</p>
                </div>
              </div>
              <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-yellow-500 h-1.5 rounded-full transition-all" style={{ width: `${userPercent}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/60 bg-white/80 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📝</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Action</p>
                    <p className="text-[11px] text-slate-500">CRUD serveurs, tickets</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-purple-600">{stats.action}</p>
                  <p className="text-[11px] text-slate-500">{actionPercent}%</p>
                </div>
              </div>
              <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${actionPercent}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/60 bg-white/80 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔒</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Sécurité</p>
                    <p className="text-[11px] text-slate-500">Accès, anomalies</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-red-600">{stats.security}</p>
                  <p className="text-[11px] text-slate-500">{securityPercent}%</p>
                </div>
              </div>
              <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{ width: `${securityPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Distribution par Sévérité */}
        <div className="rounded-xl bg-gradient-to-br from-white/80 via-white/70 to-slate-50/80 backdrop-blur-sm border border-slate-200/40 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Distribution par Sévérité</h3>
              <p className="text-[11px] text-slate-500">Vue compacte par niveau</p>
            </div>
            <span className="text-[11px] text-slate-500">Total: {stats.total}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-red-200/60 bg-red-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-red-700">Critique</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-red-700">{stats.critical}</div>
              <div className="mt-2 h-1.5 rounded-full bg-red-100">
                <div
                  className="h-1.5 rounded-full bg-red-500"
                  style={{ width: `${stats.total > 0 ? (stats.critical / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-orange-200/60 bg-orange-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-orange-700">Erreur</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {stats.total > 0 ? Math.round((stats.error / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-orange-700">{stats.error}</div>
              <div className="mt-2 h-1.5 rounded-full bg-orange-100">
                <div
                  className="h-1.5 rounded-full bg-orange-500"
                  style={{ width: `${stats.total > 0 ? (stats.error / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-yellow-200/60 bg-yellow-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-yellow-700">Avertissement</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                  {stats.total > 0 ? Math.round((stats.warning / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-yellow-700">{stats.warning}</div>
              <div className="mt-2 h-1.5 rounded-full bg-yellow-100">
                <div
                  className="h-1.5 rounded-full bg-yellow-500"
                  style={{ width: `${stats.total > 0 ? (stats.warning / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 mt-4">
            <p className="text-xs text-slate-600">
              Santé du système: <span className="font-bold text-green-600">✅ Bon</span>
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Dernière mise à jour: <span className="font-mono">{new Date().toLocaleTimeString()}</span>
            </p>
          </div>
        </div>


        {/* Filters & Export */}
        <div className="rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50/60 text-slate-900 border border-blue-100/60 shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_20px_60px_-35px_rgba(59,130,246,0.35)] p-6 space-y-5 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-purple-400/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center ring-1 ring-blue-500/20">
                <Filter size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Filtres et recherche</h2>
                <p className="text-xs text-slate-500">Interface avancée pour explorer les événements</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 text-sm font-semibold hover:bg-emerald-500/20 ring-1 ring-emerald-400/30"
              >
                <Download size={16} /> Export Logs
              </button>
              <button
                onClick={() => setShowPurgeModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-700 text-sm font-semibold hover:bg-rose-500/20 ring-1 ring-rose-400/30"
              >
                <Trash2 size={16} /> Purger
              </button>
            </div>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-blue-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Catégorie</label>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value as any); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes</option>
                <option value="system">Système</option>
                <option value="user">Utilisateur</option>
                <option value="action">Action</option>
                <option value="security">Sécurité</option>
              </select>
            </div>
            <div className="rounded-xl border border-blue-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Niveau</label>
              <select
                value={filterLevel}
                onChange={(e) => { setFilterLevel(e.target.value as any); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                <option value="info">Info</option>
                <option value="warning">Avertissement</option>
                <option value="error">Erreur</option>
                <option value="critical">Critique</option>
              </select>
            </div>
            <div className="rounded-xl border border-blue-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Module</label>
              <select
                value={filterModule}
                onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                {modules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-blue-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Utilisateur</label>
              <select
                value={filterUsername}
                onChange={(e) => { setFilterUsername(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-blue-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Jours à conserver</label>
              <input
                type="number"
                value={purgedays}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setPurgeDays(Number.isFinite(next) && next > 0 ? next : 1);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
          </div>

          <div className="relative rounded-xl border border-blue-100/70 bg-white/80 p-3">
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Recherche (action, objet, module)</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Chercher..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-2xl bg-white/90 backdrop-blur-sm border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/60 bg-gradient-to-r from-blue-50/70 via-white to-purple-50/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Journal des logs</h3>
                <p className="text-[11px] text-slate-500">Vue tabulaire moderne et lisible</p>
              </div>
              <span className="text-[11px] text-slate-500">{stats.total} entrées</span>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-slate-600">Chargement des logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-600">Aucun log disponible</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Catégorie</th>
                      <th className="px-5 py-3 text-left">Niveau</th>
                      <th className="px-5 py-3 text-left">Module</th>
                      <th className="px-5 py-3 text-left">Action</th>
                      <th className="px-5 py-3 text-left">Objet</th>
                      <th className="px-5 py-3 text-left">Utilisateur</th>
                      <th className="px-5 py-3 text-left">IP</th>
                      <th className="px-5 py-3 text-left">Détails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.map((log, index) => (
                      <tr
                        key={log.id}
                        className={`group hover:bg-blue-50/40 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      >
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${categoryPills[log.category] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            <span className={`h-2 w-2 rounded-full ${categoryDots[log.category] || 'bg-slate-400'}`} />
                            <span className="font-semibold">{categoryLabels[log.category] || 'Autre'}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${levelColors[log.level]}`}>
                            {log.level}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs font-medium text-slate-900">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {log.module}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-700">{log.action}</td>
                        <td className="px-5 py-3 text-xs text-slate-700 max-w-xs truncate">{log.objectImpacted}</td>
                        <td className="px-5 py-3 text-xs text-slate-600">{log.username || 'N/A'}</td>
                        <td className="px-5 py-3 text-xs text-slate-600 font-mono">{log.ipSource || 'N/A'}</td>
                        <td className="px-5 py-3 text-xs">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-xs transition"
                          >
                            Voir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-t border-slate-200/60">
                <span className="text-xs text-slate-600">
                  Page {page} sur {totalPages} ({stats.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-md bg-slate-200 text-slate-900 text-sm font-medium disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-md bg-slate-200 text-slate-900 text-sm font-medium disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Purge Modal */}
        {showPurgeModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-6 w-full max-w-md mx-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">Purger les anciens logs</h3>
                  <p className="text-sm text-slate-600 mt-1">Supprimez les logs datant de plus de</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Nombre de jours à conserver</label>
                <input
                  type="number"
                  value={purgedays}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setPurgeDays(Number.isFinite(next) && next > 0 ? next : 1);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  min="1"
                />
                <p className="text-xs text-slate-500 mt-2">Les logs antérieurs à {purgedays} jours seront supprimés de manière définitive.</p>
              </div>

              {purgeMessage && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${purgeMessage.includes('succès') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {purgeMessage}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowPurgeModal(false);
                    setPurgeMessage('');
                  }}
                  disabled={purgeLoading}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmPurge}
                  disabled={purgeLoading}
                  className="px-4 py-2 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {purgeLoading ? (
                    <>
                      <span className="animate-spin">⏳</span> Purge en cours...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} /> Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Détails du log</h3>
                  <p className="text-xs text-slate-500 mt-1">ID: {selectedLog.id}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X size={20} className="text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Date/Heure</p>
                    <p className="font-semibold text-slate-900">{new Date(selectedLog.timestamp).toLocaleString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Catégorie</p>
                    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${categoryPills[selectedLog.category] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      <span className={`h-2 w-2 rounded-full ${categoryDots[selectedLog.category] || 'bg-slate-400'}`} />
                      <span className="font-semibold text-xs">{categoryLabels[selectedLog.category] || 'Autre'}</span>
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Niveau</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full border inline-block ${levelColors[selectedLog.level]}`}>
                      {selectedLog.level}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Module</p>
                    <p className="font-semibold text-slate-900">{selectedLog.module}</p>
                  </div>
                </div>

                {/* Main Content */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Action</p>
                    <p className="text-sm font-medium text-slate-900">{selectedLog.action}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Objet impacté</p>
                    <p className="text-sm text-slate-700 break-words">{selectedLog.objectImpacted}</p>
                  </div>
                  {selectedLog.username && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Utilisateur</p>
                      <p className="text-sm text-slate-900">{selectedLog.username}</p>
                    </div>
                  )}
                  {selectedLog.ipSource && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Adresse IP</p>
                      <p className="text-sm font-mono text-slate-900">{selectedLog.ipSource}</p>
                    </div>
                  )}
                  {(selectedLog.oldValue || selectedLog.newValue) && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                      {selectedLog.oldValue && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Ancienne valeur</p>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 break-words">
                            {selectedLog.oldValue}
                          </div>
                        </div>
                      )}
                      {selectedLog.newValue && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Nouvelle valeur</p>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800 break-words">
                            {selectedLog.newValue}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Détails supplémentaires</p>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <pre className="text-xs text-slate-700 overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
