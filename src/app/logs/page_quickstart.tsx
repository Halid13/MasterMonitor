'use client';

import React from 'react';
import { ArrowRight, CheckCircle, Zap, BookOpen, Code } from 'lucide-react';

export default function LogsQuickStartPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-32 lg:px-8">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">Système de Logging Réel</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
            Logs Réels en Temps Réel
          </h1>

          <p className="text-xl text-slate-300 mb-12 max-w-3xl mx-auto">
            Système de logging complet avec 4 catégories:
            <br />
            <span className="text-blue-300">Système • Utilisateurs • Actions • Sécurité</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/logs/test"
              className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all transform hover:scale-105 inline-flex items-center justify-center gap-2"
            >
              🧪 Tester Maintenant
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="/logs/stats"
              className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2"
            >
              📊 Voir Statistiques
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            {
              icon: '⚙️',
              title: 'Système',
              description: 'Métriques, santé, changements de statut'
            },
            {
              icon: '👤',
              title: 'Utilisateurs',
              description: 'Authentification, sessions'
            },
            {
              icon: '📝',
              title: 'Actions',
              description: 'CRUD serveurs, tickets, équipements'
            },
            {
              icon: '🔒',
              title: 'Sécurité',
              description: 'Accès, authentification, anomalies'
            }
          ].map((category, idx) => (
            <div
              key={idx}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-blue-500/50 transition-colors"
            >
              <div className="text-3xl mb-3">{category.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{category.title}</h3>
              <p className="text-slate-400 text-sm">{category.description}</p>
            </div>
          ))}
        </div>

        {/* Getting Started */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-8">🚀 Démarrage Rapide</h2>

          <div className="space-y-6">
            {[
              {
                step: 1,
                title: 'Générer des logs de test',
                description: 'Visitez la page de test pour générer des événements de log',
                link: '/logs/test'
              },
              {
                step: 2,
                title: 'Consulter les logs',
                description: 'Visualisez tous les logs avec filtrage et recherche avancés',
                link: '/logs'
              },
              {
                step: 3,
                title: 'Analyser les statistiques',
                description: 'Voir les graphiques et statistiques en temps réel',
                link: '/logs/stats'
              },
              {
                step: 4,
                title: 'Intégrer dans votre code',
                description: 'Suivez le guide pour intégrer les logs dans vos pages',
                link: '/logs/integration-guide'
              }
            ].map((item) => (
              <div key={item.step} className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-500 text-white font-bold">
                    {item.step}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="text-slate-400 mt-1">{item.description}</p>
                  <a
                    href={item.link}
                    className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-flex items-center gap-1"
                  >
                    Accéder <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code Example */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Code className="w-6 h-6" />
            Exemple d'Intégration
          </h2>

          <div className="bg-slate-900 rounded p-4 overflow-x-auto mb-4">
            <pre className="text-slate-300 text-sm font-mono">
              {`import { captureUserActions } from '@/services/userActionCapture';

// Dans votre handler de création de serveur
const handleCreateServer = async (formData) => {
  const serverId = 'srv-' + Date.now();
  
  // Capturer l'action
  captureUserActions.serverCreated(
    serverId,
    formData.name,
    currentUser.username,
    { group: 'production', sla: 'critical' }
  );
  
  // Le log est automatiquement créé!
};`}
            </pre>
          </div>

          <p className="text-slate-400 text-sm">
            C'est aussi simple que ça! Le log est créé automatiquement et visible dans le dashboard.
          </p>
        </div>

        {/* API Reference */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">📡 API REST</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                method: 'GET',
                endpoint: '/api/logs',
                description: 'Récupérer les logs avec filtres'
              },
              {
                method: 'POST',
                endpoint: '/api/logs',
                description: 'Créer un nouveau log'
              },
              {
                method: 'DELETE',
                endpoint: '/api/logs',
                description: 'Supprimer ou purger les logs'
              },
              {
                method: 'POST',
                endpoint: '/api/logs/test',
                description: 'Générer un log de test'
              }
            ].map((api, idx) => (
              <div key={idx} className="bg-slate-700/50 rounded p-4 border border-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded text-xs font-bold ${
                    api.method === 'GET' ? 'bg-blue-500 text-white' :
                    api.method === 'POST' ? 'bg-green-500 text-white' :
                    'bg-red-500 text-white'
                  }`}>
                    {api.method}
                  </span>
                  <code className="text-slate-300 text-sm font-mono">{api.endpoint}</code>
                </div>
                <p className="text-slate-400 text-sm">{api.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features List */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">✨ Caractéristiques</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'Capture automatique des événements système',
              'Logging de toutes les actions utilisateur (CRUD)',
              'Audit de sécurité complète',
              'Recherche et filtrage avancés',
              'Export en CSV',
              'Pagination automatique',
              'Statistiques en temps réel',
              'API REST complète',
              'Interface Web intuitive',
              'Documentation complète',
              '40+ exemples de code',
              'Tests interactifs intégrés'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900/50 border-t border-slate-700 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4">🧪 Test</h3>
              <a href="/logs/test" className="text-slate-400 hover:text-white text-sm">
                Générer logs de test
              </a>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">📊 Dashboard</h3>
              <div className="space-y-2">
                <a href="/logs" className="text-slate-400 hover:text-white text-sm block">
                  Voir tous les logs
                </a>
                <a href="/logs/stats" className="text-slate-400 hover:text-white text-sm block">
                  Statistiques
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">📚 Documentation</h3>
              <a href="/logs/integration-guide" className="text-slate-400 hover:text-white text-sm">
                Guide d'intégration
              </a>
            </div>
          </div>

          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-slate-400 text-sm">
            <p>✨ Système de Logging Réel pour MasterMonitor | 4 Catégories • 4 Niveaux • 100% Couverture</p>
          </div>
        </div>
      </div>
    </div>
  );
}
