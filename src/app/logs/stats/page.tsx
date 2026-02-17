'use client';

import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, AlertTriangle, Shield } from 'lucide-react';

interface LogStats {
  totalLogs: number;
  systemLogs: number;
  userLogs: number;
  actionLogs: number;
  securityLogs: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  lastLogTime?: Date;
}

export default function LogsStatsPage() {
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchStats() {
    try {
      const res = await fetch('/api/logs/test');
      const data = await res.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-slate-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-slate-600">Erreur lors du chargement des statistiques</p>
        </div>
      </div>
    );
  }

  // Calculer les pourcentages
  const systemPercent = stats.totalLogs > 0 ? (stats.systemLogs / stats.totalLogs * 100).toFixed(1) : 0;
  const userPercent = stats.totalLogs > 0 ? (stats.userLogs / stats.totalLogs * 100).toFixed(1) : 0;
  const actionPercent = stats.totalLogs > 0 ? (stats.actionLogs / stats.totalLogs * 100).toFixed(1) : 0;
  const securityPercent = stats.totalLogs > 0 ? (stats.securityLogs / stats.totalLogs * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="w-10 h-10 text-blue-600" />
              Statistiques des Logs
            </h1>
            <p className="text-slate-600 mt-2">Vue en temps réel du système de logging</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                autoRefresh
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
              }`}
            >
              {autoRefresh ? '⏸️ Auto-refresh ON' : '▶️ Auto-refresh OFF'}
            </button>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-colors"
            >
              🔄 Rafraîchir
            </button>
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold">Total des Logs</h3>
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-4xl font-bold text-blue-600">{stats.totalLogs.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-2">Tous les logs du système</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold">Événements Critiques</h3>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-4xl font-bold text-red-600">{stats.criticalCount}</div>
            <p className="text-xs text-slate-500 mt-2">Demandent une attention immédiate</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold">Erreurs</h3>
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-4xl font-bold text-yellow-600">{stats.errorCount}</div>
            <p className="text-xs text-slate-500 mt-2">Erreurs à surveiller</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-semibold">Avertissements</h3>
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-4xl font-bold text-orange-600">{stats.warningCount}</div>
            <p className="text-xs text-slate-500 mt-2">À surveiller</p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Répartition par Catégorie</h2>
          
          <div className="space-y-4">
            {/* System */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚙️</span>
                  <span className="font-semibold text-slate-900">Système</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-cyan-600">{stats.systemLogs}</div>
                  <div className="text-xs text-slate-500">{systemPercent}% du total</div>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-cyan-500 h-2 rounded-full transition-all"
                  style={{ width: `${systemPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Métriques, changements de statut, health checks</p>
            </div>

            {/* User */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👤</span>
                  <span className="font-semibold text-slate-900">Utilisateur</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-600">{stats.userLogs}</div>
                  <div className="text-xs text-slate-500">{userPercent}% du total</div>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{ width: `${userPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Authentification, sessions utilisateur</p>
            </div>

            {/* Action */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  <span className="font-semibold text-slate-900">Action</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">{stats.actionLogs}</div>
                  <div className="text-xs text-slate-500">{actionPercent}% du total</div>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${actionPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">CRUD serveurs, tickets, équipements</p>
            </div>

            {/* Security */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔒</span>
                  <span className="font-semibold text-slate-900">Sécurité</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-600">{stats.securityLogs}</div>
                  <div className="text-xs text-slate-500">{securityPercent}% du total</div>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ width: `${securityPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Accès, authentification, anomalies</p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Category Distribution Pie */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Distribution par Catégorie</h3>
            <div className="flex items-center justify-center h-48">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="20"
                    strokeDasharray={`${systemPercent * 2.512} 251.2`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="20"
                    strokeDasharray={`${userPercent * 2.512} 251.2`}
                    strokeDashoffset={`-${systemPercent * 2.512}`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="20"
                    strokeDasharray={`${actionPercent * 2.512} 251.2`}
                    strokeDashoffset={`-${(systemPercent + userPercent) * 2.512}`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="20"
                    strokeDasharray={`${securityPercent * 2.512} 251.2`}
                    strokeDashoffset={`-${(systemPercent + userPercent + actionPercent) * 2.512}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{stats.totalLogs}</div>
                    <div className="text-xs text-slate-600">Total</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                <span>Système: {stats.systemLogs}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Utilisateur: {stats.userLogs}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Action: {stats.actionLogs}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Sécurité: {stats.securityLogs}</span>
              </div>
            </div>
          </div>

          {/* Severity Distribution */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Distribution par Sévérité</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-red-700">🔴 Critique</span>
                  <span className="text-sm font-bold text-red-700">{stats.criticalCount}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${stats.totalLogs > 0 ? (stats.criticalCount / stats.totalLogs * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-orange-700">🟠 Erreur</span>
                  <span className="text-sm font-bold text-orange-700">{stats.errorCount}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-orange-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${stats.totalLogs > 0 ? (stats.errorCount / stats.totalLogs * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-yellow-700">🟡 Avertissement</span>
                  <span className="text-sm font-bold text-yellow-700">{stats.warningCount}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-yellow-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${stats.totalLogs > 0 ? (stats.warningCount / stats.totalLogs * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 mt-4">
                <p className="text-xs text-slate-600">
                  Santé du système: <span className="font-bold text-green-600">✅ Bon</span>
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Dernière mise à jour: <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Actions Rapides</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/logs/test"
              className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-colors hover:shadow-md"
            >
              <div className="font-semibold text-slate-900">🧪 Générer Logs de Test</div>
              <p className="text-sm text-slate-600 mt-1">Créez des événements de log pour tester</p>
            </a>
            <a
              href="/logs"
              className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-colors hover:shadow-md"
            >
              <div className="font-semibold text-slate-900">📊 Voir Tous les Logs</div>
              <p className="text-sm text-slate-600 mt-1">Consultez la liste complète avec filtres</p>
            </a>
            <a
              href="/logs/integration-guide"
              className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-colors hover:shadow-md"
            >
              <div className="font-semibold text-slate-900">📚 Guide d'Intégration</div>
              <p className="text-sm text-slate-600 mt-1">Apprenez à intégrer les logs</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
