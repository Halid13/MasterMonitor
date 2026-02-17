'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Activity, Lock, Users, Server, Zap } from 'lucide-react';

interface TestScenario {
  id: string;
  name: string;
  icon: React.ReactNode;
  action: string;
  params?: Record<string, any>;
  description: string;
}

const testScenarios: TestScenario[] = [
  {
    id: 'server-online',
    name: 'Serveur Online',
    icon: <Server className="w-4 h-4" />,
    action: 'server-status-changed',
    params: { 
      serverId: 'srv-web-01', 
      serverName: 'Web-Server-01',
      oldStatus: 'offline',
      newStatus: 'online',
      reason: 'Network connectivity restored'
    },
    description: 'Simule un serveur qui passe en ligne',
  },
  {
    id: 'server-offline',
    name: 'Serveur Offline',
    icon: <AlertCircle className="w-4 h-4" />,
    action: 'server-status-changed',
    params: { 
      serverId: 'srv-db-01', 
      serverName: 'Database-Server-01',
      oldStatus: 'online',
      newStatus: 'offline',
      reason: 'Network timeout - server unreachable'
    },
    description: 'Simule un serveur qui passe hors ligne',
  },
  {
    id: 'cpu-anomaly',
    name: 'Anomalie CPU',
    icon: <Zap className="w-4 h-4" />,
    action: 'metrics-anomaly',
    params: { 
      serverId: 'srv-app-01', 
      serverName: 'App-Server-01',
      metric: 'CPU',
      value: 95.2,
      threshold: 80
    },
    description: 'Détecte une utilisation CPU anormale (95%)',
  },
  {
    id: 'memory-anomaly',
    name: 'Anomalie Mémoire',
    icon: <Zap className="w-4 h-4" />,
    action: 'metrics-anomaly',
    params: { 
      serverId: 'srv-app-02', 
      serverName: 'App-Server-02',
      metric: 'RAM',
      value: 92.8,
      threshold: 85
    },
    description: 'Détecte une utilisation mémoire anormale (92.8%)',
  },
  {
    id: 'service-down',
    name: 'Service Arrêté',
    icon: <Activity className="w-4 h-4" />,
    action: 'service-state-changed',
    params: { 
      serverId: 'srv-web-02', 
      serverName: 'Web-Server-02',
      serviceName: 'IIS',
      oldState: 'running',
      newState: 'stopped'
    },
    description: 'Simule l\'arrêt d\'un service',
  },
  {
    id: 'health-check',
    name: 'Vérification Santé',
    icon: <Activity className="w-4 h-4" />,
    action: 'health-check',
    params: { 
      serverId: 'srv-001', 
      serverName: 'Monitor-Server',
      healthScore: 82.5,
      previousScore: 85.0
    },
    description: 'Effectue un contrôle de santé du serveur',
  },
  {
    id: 'server-create',
    name: 'Créer Serveur',
    icon: <Server className="w-4 h-4" />,
    action: 'server-created',
    params: { 
      serverId: 'srv-prod-new-01', 
      serverName: 'New-Production-Server',
      username: 'admin',
      details: { group: 'production', sla: 'critique' }
    },
    description: 'Enregistre la création d\'un nouveau serveur',
  },
  {
    id: 'server-modify',
    name: 'Modifier Serveur',
    icon: <Server className="w-4 h-4" />,
    action: 'server-modified',
    params: { 
      serverId: 'srv-001', 
      serverName: 'Server-01',
      username: 'technician@monitor.local',
      changes: { sla: 'important', owner: 'john.doe@company.com' }
    },
    description: 'Enregistre la modification d\'un serveur',
  },
  {
    id: 'ticket-create',
    name: 'Créer Ticket',
    icon: <AlertCircle className="w-4 h-4" />,
    action: 'ticket-created',
    params: { 
      ticketId: 'tkt-2024-001', 
      title: 'Server-01 is experiencing high CPU usage',
      createdBy: 'user@monitor.local',
      details: { priority: 'high', category: 'performance' }
    },
    description: 'Crée un nouveau ticket helpdesk',
  },
  {
    id: 'login-success',
    name: 'Connexion Réussie',
    icon: <Users className="w-4 h-4" />,
    action: 'login-success',
    params: { 
      username: 'admin',
      ipSource: '192.168.1.100'
    },
    description: 'Enregistre une connexion réussie',
  },
  {
    id: 'login-failed',
    name: 'Connexion Échouée',
    icon: <Lock className="w-4 h-4" />,
    action: 'login-failed',
    params: { 
      username: 'admin',
      ipSource: '192.168.1.105',
      reason: 'Invalid credentials'
    },
    description: 'Enregistre une tentative de connexion échouée',
  },
  {
    id: 'unauthorized',
    name: 'Accès Non Autorisé',
    icon: <Lock className="w-4 h-4" />,
    action: 'unauthorized-access',
    params: { 
      username: 'user@monitor.local',
      resource: '/api/admin/configuration',
      ipSource: '192.168.1.110'
    },
    description: 'Enregistre une tentative d\'accès non autorisé',
  },
];

export default function LogsTestPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [autoTest, setAutoTest] = useState(false);

  // Fetch initial stats
  useEffect(() => {
    fetchStats();
  }, []);

  // Auto-generate logs if enabled
  useEffect(() => {
    if (!autoTest) return;

    const interval = setInterval(() => {
      const randomScenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];
      triggerScenario(randomScenario);
    }, 3000);

    return () => clearInterval(interval);
  }, [autoTest]);

  async function fetchStats() {
    try {
      const res = await fetch('/api/logs/test');
      const data = await res.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  async function triggerScenario(scenario: TestScenario) {
    setLoading(true);
    try {
      const res = await fetch('/api/logs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: scenario.action,
          ...scenario.params,
        }),
      });

      const data = await res.json();
      
      if (data.ok) {
        setMessage(`✓ ${scenario.name} - Log créé avec succès`);
        setTimeout(() => fetchStats(), 500);
      } else {
        setMessage(`✗ Erreur: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`✗ Erreur réseau: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">🧪 Test des Logs en Temps Réel</h1>
          <p className="text-slate-600">Générez des événements de log pour tester le système</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-2xl font-bold text-blue-600">{stats.totalLogs}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wide">Total Logs</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-cyan-500">
              <div className="text-2xl font-bold text-cyan-600">{stats.systemLogs}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wide">System</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-2xl font-bold text-yellow-600">{stats.userLogs}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wide">User</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="text-2xl font-bold text-purple-600">{stats.actionLogs}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wide">Action</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-2xl font-bold text-red-600">{stats.securityLogs}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wide">Security</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-pink-500">
              <div className="text-2xl font-bold text-pink-600">{stats.criticalCount}</div>
              <div className="text-xs text-slate-600 uppercase tracking-wide">Critical</div>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.startsWith('✓') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* Auto-test toggle */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => setAutoTest(!autoTest)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              autoTest
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {autoTest ? '⏹️ Arrêter Auto-Test' : '▶️ Démarrer Auto-Test'}
          </button>
          <p className="text-sm text-slate-600">
            {autoTest ? 'Génération automatique toutes les 3 secondes...' : 'Déclenchez manuellement ou activez le mode automatique'}
          </p>
        </div>

        {/* Test Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testScenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => triggerScenario(scenario)}
              disabled={loading}
              className="bg-white rounded-lg shadow hover:shadow-md transition-all p-4 text-left border border-slate-200 hover:border-slate-300 disabled:opacity-50"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="text-slate-600 mt-1">{scenario.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{scenario.name}</h3>
                  <p className="text-xs text-slate-600 mt-1">{scenario.description}</p>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                {scenario.action}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
          <h3 className="font-semibold mb-2">💡 Comment ça marche?</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Cliquez sur un scénario pour générer un log test</li>
            <li>Les logs sont créés en temps réel via l'API <code className="bg-blue-100 px-2 py-1 rounded">/api/logs/test</code></li>
            <li>Les statistiques se mettent à jour automatiquement</li>
            <li>Visitez <a href="/logs" className="underline font-semibold">/logs</a> pour voir tous les logs en détail</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
