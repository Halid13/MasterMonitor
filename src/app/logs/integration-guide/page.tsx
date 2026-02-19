import { AlertCircle, CheckCircle, BookOpen } from 'lucide-react';

export default function LogsIntegrationGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📚 Guide d'Intégration des Logs</h1>
          <p className="text-slate-600">Comment intégrer les logs dans votre application</p>
        </div>

        {/* Quick Start */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" /> Quick Start
          </h2>
          <p className="text-blue-900 mb-4">Trois modules de logging prêts à l'emploi:</p>
          <div className="space-y-3">
            <div className="bg-white rounded p-3 font-mono text-sm">
              <div className="text-blue-600 font-bold">1. Logs Système</div>
              <code>import {'{ logger }'} from '@/services/logger';</code><br/>
              <code>logger.logSystem('action', 'objectImpacted', 'info');</code>
            </div>
            <div className="bg-white rounded p-3 font-mono text-sm">
              <div className="text-blue-600 font-bold">2. Logs Utilisateurs</div>
              <code>import {'{ captureUserActions }'} from '@/services/userActionCapture';</code><br/>
              <code>captureUserActions.serverCreated(id, name, username);</code>
            </div>
            <div className="bg-white rounded p-3 font-mono text-sm">
              <div className="text-blue-600 font-bold">3. Logs Sécurité</div>
              <code>import {'{ captureSecurityEvents }'} from '@/services/securityEventCapture';</code><br/>
              <code>captureSecurityEvents.loginSuccess(username, ipSource);</code>
            </div>
          </div>
        </div>

        {/* Integration Examples */}
        <div className="space-y-8 mb-12">
          {/* System Logs */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-cyan-500">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-cyan-600" /> Logs Système
            </h3>
            <p className="text-slate-600 mb-4">Pour les événements techniques et changements de métriques:</p>
            <div className="bg-slate-50 rounded p-4 overflow-auto">
              <code className="text-sm text-slate-700 whitespace-pre-wrap">{`
// Dans src/app/api/system/metrics/route.ts
import { logger } from '@/services/logger';
import { captureSystemEvents } from '@/services/eventCapture';

// Log changement de statut serveur
captureSystemEvents.serverStatusChanged(
  'srv-001',
  'Production-Server',
  oldStatus,
  newStatus,
  'Network timeout'
);

// Log anomalie CPU/RAM
captureSystemEvents.metricsAnomalyDetected(
  'srv-001',
  'Production-Server',
  'CPU',
  92.5,
  80
);

// Log santé du serveur
captureSystemEvents.healthCheckPerformed(
  'srv-001',
  'Production-Server',
  85.5,
  88.2
);
              `}</code>
            </div>
          </div>

          {/* User Action Logs */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" /> Logs Actions Utilisateur
            </h3>
            <p className="text-slate-600 mb-4">Pour les opérations CRUD (création, modification, suppression):</p>
            <div className="bg-slate-50 rounded p-4 overflow-auto">
              <code className="text-sm text-slate-700 whitespace-pre-wrap">{`
// Dans les pages/composants
import { captureUserActions } from '@/services/userActionCapture';

// Création d'un serveur
captureUserActions.serverCreated(
  'srv-new-001',
  'New-Server',
  'admin@monitor.local',
  { group: 'production', sla: 'critique' }
);

// Modification d'un serveur
captureUserActions.serverModified(
  'srv-001',
  'Server-01',
  'technician@monitor.local',
  { sla: 'important', owner: 'john.doe' },
  { sla: 'standard', owner: 'previous' }
);

// Suppression d'un serveur
captureUserActions.serverDeleted(
  'srv-old-001',
  'Old-Server',
  'admin@monitor.local',
  'End of life'
);

// Création de ticket
captureUserActions.ticketCreated(
  'tkt-001',
  'Server is down',
  'user@monitor.local',
  { priority: 'critical', category: 'hardware' }
);
              `}</code>
            </div>
          </div>

          {/* Security Event Logs */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" /> Logs Sécurité
            </h3>
            <p className="text-slate-600 mb-4">Pour les événements de sécurité et authentification:</p>
            <div className="bg-slate-50 rounded p-4 overflow-auto">
              <code className="text-sm text-slate-700 whitespace-pre-wrap">{`
// Dans les endpoints d'authentification
import { captureSecurityEvents } from '@/services/securityEventCapture';

// Connexion réussie
captureSecurityEvents.loginSuccess(
  'admin',
  '192.168.1.100'
);

// Connexion échouée
captureSecurityEvents.loginFailed(
  'admin',
  '192.168.1.105',
  'Invalid credentials'
);

// Tentative d'accès non autorisé
captureSecurityEvents.unauthorizedAccess(
  'user@monitor.local',
  '/api/admin/settings',
  '192.168.1.110'
);

// Changement de permissions
captureSecurityEvents.permissionChanged(
  'john.doe',
  'user',
  'admin',
  'admin@monitor.local',
  '192.168.1.100',
  'Promotion to admin role'
);

// Données sensibles modifiées
captureSecurityEvents.sensitiveDataModified(
  'admin@monitor.local',
  'UserPassword',
  'user-001',
  'old_hash',
  'new_hash',
  '192.168.1.100',
  'User requested password change'
);
              `}</code>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">📊 Catégories de Logs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-l-4 border-cyan-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">⚙️ System</h4>
              <p className="text-sm text-slate-600">Événements techniques: démarrage/arrêt de services, changements de métriques, health checks</p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">👤 User</h4>
              <p className="text-sm text-slate-600">Authentification et actions des utilisateurs</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">📝 Action</h4>
              <p className="text-sm text-slate-600">CRUD sur serveurs, équipements, tickets, utilisateurs</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h4 className="font-semibold text-slate-900 mb-2">🔒 Security</h4>
              <p className="text-sm text-slate-600">Accès non autorisé, tentatives de brute force, modifications sensibles</p>
            </div>
          </div>
        </div>

        {/* Log Levels */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">🎯 Niveaux de Log</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded">
              <span className="text-blue-600 font-bold">ℹ️ INFO</span>
              <span className="text-sm text-slate-600">Événements normaux</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded">
              <span className="text-yellow-600 font-bold">⚠️ WARNING</span>
              <span className="text-sm text-slate-600">Événements à surveiller</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded">
              <span className="text-red-600 font-bold">❌ ERROR</span>
              <span className="text-sm text-slate-600">Erreurs à corriger</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-100 rounded">
              <span className="text-red-800 font-bold">🔴 CRITICAL</span>
              <span className="text-sm text-slate-600">Événements critiques</span>
            </div>
          </div>
        </div>

        {/* Tools & Resources */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Outils & Ressources
          </h3>
          <div className="space-y-2 text-sm text-green-900">
            <p>✓ Page de test: <a href="/logs/test" className="underline font-semibold">/logs/test</a> - Générez des logs de test</p>
            <p>✓ Dashboard logs: <a href="/logs" className="underline font-semibold">/logs</a> - Consultez tous les logs</p>
            <p>✓ API logs: <code className="bg-green-100 px-2 py-1 rounded">/api/logs</code> - GET/POST/DELETE</p>
            <p>✓ API test: <code className="bg-green-100 px-2 py-1 rounded">/api/logs/test</code> - POST pour créer logs de test</p>
          </div>
        </div>
      </div>
    </div>
  );
}
