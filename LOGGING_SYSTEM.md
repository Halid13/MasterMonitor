# 📋 Système de Logging - MasterMonitor

## Vue d'ensemble

Le système de logging de MasterMonitor capture automatiquement les événements en **4 catégories principales**:

### 1. **⚙️ Logs Système** 
Événements techniques automatisés:
- Changements de statut des serveurs (online/offline/warning)
- Anomalies détectées (CPU, RAM, Disk > seuil)
- Health checks des serveurs
- Changements de state de services
- Redémarrages/Uptime changes
- Statut backup/antivirus

### 2. **👤 Logs Utilisateurs**
Actions des utilisateurs CRUD (Create, Read, Update, Delete):
- Authentification (connexion/déconnexion)
- Actions sur serveurs (créer, modifier, supprimer)
- Actions sur tickets (créer, modifier, fermer)
- Actions sur équipements
- Actions sur utilisateurs
- Export/Import de données

### 3. **📝 Logs Actions**
Opérations sur l'infrastructure:
- Modifications de serveurs
- Création/modification/suppression de tickets
- Création/modification/suppression d'équipements
- Changements de configuration

### 4. **🔒 Logs Sécurité**
Événements de sécurité:
- Tentatives de connexion (réussie/échouée)
- Accès non autorisé
- Changements de permissions
- Accès à données sensibles
- Modifications de données sensibles
- Anomalies de sécurité
- Tentatives d'escalade de privilèges
- Violations de politique
- Suspension/Activation de comptes
- Détection de brute force

---

## 🏗️ Architecture du Logging

### Modules Principaux

```
src/services/
├── logger.ts                    # Core logger avec 4 méthodes principales
├── eventCapture.ts              # Capture automatique des événements système
├── userActionCapture.ts         # Capture des actions utilisateur (CRUD)
├── securityEventCapture.ts      # Capture des événements de sécurité
└── LOGGING_EXAMPLES.ts          # Exemples d'utilisation

src/app/api/
├── logs/route.ts                # API pour GET/POST/DELETE logs
├── logs/test/route.ts           # API pour générer logs de test
└── logs/stats                   # Stats en temps réel

src/app/logs/
├── page.tsx                     # Dashboard principal des logs
├── test/page.tsx                # Page de test avec UI interactive
└── integration-guide/page.tsx   # Guide d'intégration
```

### Stockage
- **En mémoire** (10 000 logs maximum) - Parfait pour démo/monitoring court terme
- **Prêt pour migration vers** PostgreSQL/MongoDB pour production

### Format des Logs

```typescript
interface SystemLog {
  id: string;                    // ID unique
  timestamp: Date;               // Quand l'événement s'est produit
  category: 'system' | 'user' | 'action' | 'security';
  level: 'info' | 'warning' | 'error' | 'critical';
  username?: string;             // Qui l'a fait
  module: string;                // Quel module (Server, Ticket, Security)
  action: string;                // Action effectuée
  objectImpacted: string;        // Objet affecté (serveur ID, ticket ID, etc)
  oldValue?: string;             // Ancienne valeur (pour updates)
  newValue?: string;             // Nouvelle valeur (pour updates)
  ipSource?: string;             // IP source de l'action
  details?: Record<string, any>; // Détails additionnels
  resolved?: boolean;            // État (résolu ou non)
}
```

---

## 🚀 Utilisation

### 1. Logs Système Basiques

```typescript
import { logger } from '@/services/logger';

logger.logSystem(
  'Database Connection Error',
  'Primary-DB-Server',
  'error',
  { connectionType: 'SQL', timeout: '30s' }
);
```

### 2. Événements Système (Automatiques)

```typescript
import { captureSystemEvents } from '@/services/eventCapture';

// Appelé automatiquement lors du polling des métriques
captureSystemEvents.serverStatusChanged(
  'srv-001',
  'Production-Server',
  'online',
  'offline',
  'Network timeout'
);

captureSystemEvents.metricsAnomalyDetected(
  'srv-001',
  'Production-Server',
  'CPU',
  95.2,
  80  // threshold
);
```

### 3. Actions Utilisateur

```typescript
import { captureUserActions } from '@/services/userActionCapture';

// CRUD Serveurs
captureUserActions.serverCreated('srv-001', 'New-Server', 'admin');
captureUserActions.serverModified('srv-001', 'Server', 'tech', { sla: 'important' });
captureUserActions.serverDeleted('srv-001', 'Server', 'admin', 'EOL');

// CRUD Tickets
captureUserActions.ticketCreated('tkt-001', 'Server Down', 'user');
captureUserActions.ticketModified('tkt-001', 'Server Down', 'tech', { status: 'resolved' });
captureUserActions.ticketClosed('tkt-001', 'Server Down', 'tech', 'Fixed');
```

### 4. Événements de Sécurité

```typescript
import { captureSecurityEvents } from '@/services/securityEventCapture';

// Authentification
captureSecurityEvents.loginSuccess('john.doe', '192.168.1.100');
captureSecurityEvents.loginFailed('admin', '192.168.1.105', 'Invalid credentials');

// Accès et permissions
captureSecurityEvents.unauthorizedAccess('user', '/admin', '192.168.1.110');
captureSecurityEvents.permissionChanged('john.doe', 'user', 'admin', 'admin');

// Sécurité
captureSecurityEvents.securityAnomalyDetected(
  'SQL Injection Detected',
  'critical',
  'Malformed SQL in /api/search'
);
```

---

## 📊 API REST

### GET /api/logs
Récupère les logs avec filtres et pagination

```bash
curl "http://localhost:3000/api/logs?category=system&level=critical&limit=50&offset=0"
```

Query Parameters:
- `category`: 'system' | 'user' | 'action' | 'security'
- `level`: 'info' | 'warning' | 'error' | 'critical'
- `module`: String (search)
- `username`: String (search)
- `search`: String (recherche libre)
- `limit`: Number (par défaut: 100)
- `offset`: Number (par défaut: 0)

### POST /api/logs
Crée un log manuellement

```bash
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d {
    "category": "security",
    "level": "warning",
    "module": "Auth",
    "action": "Unauthorized Access",
    "objectImpacted": "admin_panel",
    "username": "attacker",
    "ipSource": "192.168.1.200"
  }
```

### DELETE /api/logs
Supprime les logs

```bash
# Vider tous les logs
curl -X DELETE "http://localhost:3000/api/logs?action=clear"

# Supprimer les logs > 30 jours
curl -X DELETE "http://localhost:3000/api/logs?action=purge-old&days=30"
```

### POST /api/logs/test
Génère des logs de test (pour démo)

```bash
curl -X POST http://localhost:3000/api/logs/test \
  -H "Content-Type: application/json" \
  -d { "action": "server-status-changed", "newStatus": "offline" }
```

---

## 🧪 Outils de Test

### 1. Page de Test Interactive
URL: `http://localhost:3000/logs/test`

- 12 scénarios de test prédéfinis
- Mode auto-test (génère un log toutes les 3 secondes)
- Stats en temps réel
- Interface visuelle

### 2. Guide d'Intégration
URL: `http://localhost:3000/logs/integration-guide`

- Explications détaillées
- Exemples de code
- Patterns recommandés

### 3. Dashboard Logs
URL: `http://localhost:3000/logs`

- Vue de tous les logs
- Filtrage avancé
- Recherche
- Export CSV
- Purge configurable

---

## 📈 Niveaux de Log

| Niveau | Couleur | Utilisation | Exemple |
|--------|---------|-------------|---------|
| **info** | 🔵 Bleu | Événement normal | "User logged in successfully" |
| **warning** | 🟡 Jaune | À surveiller | "CPU usage at 85%" |
| **error** | 🔴 Rouge | Erreur | "Database connection timeout" |
| **critical** | 🔴 Maroon | URGENT | "Server down - no response" |

---

## 📦 Intégration dans vos endpoints

### Exemple 1: API de création de serveur

```typescript
// src/app/api/servers/create/route.ts
import { captureUserActions } from '@/services/userActionCapture';

export async function POST(request: Request) {
  const { name, group, sla, owner } = await request.json();
  const username = request.headers.get('x-user-id');
  
  // Créer le serveur...
  const serverId = 'srv-' + Date.now();
  
  // Capturer l'action
  captureUserActions.serverCreated(
    serverId,
    name,
    username,
    { group, sla, owner }
  );
  
  return Response.json({ ok: true, serverId });
}
```

### Exemple 2: API de modification de serveur

```typescript
// Avant modification
captureUserActions.serverModified(
  'srv-001',
  'Server-01',
  'technician@monitor.local',
  { sla: 'important', owner: 'john.doe' },  // Changes
  { sla: 'standard', owner: 'previous' }    // Old values
);
```

### Exemple 3: Capture de metrics

```typescript
// src/app/api/system/metrics/route.ts
import { captureSystemEvents } from '@/services/eventCapture';

// Dans votre polling des métriques
if (newStatus !== oldStatus) {
  captureSystemEvents.serverStatusChanged(
    server.id,
    server.name,
    oldStatus,
    newStatus
  );
}

if (cpuUsage > CPU_THRESHOLD) {
  captureSystemEvents.metricsAnomalyDetected(
    server.id,
    server.name,
    'CPU',
    cpuUsage,
    CPU_THRESHOLD
  );
}
```

### Exemple 4: Authentification

```typescript
// src/app/api/auth/login/route.ts
import { captureSecurityEvents } from '@/services/securityEventCapture';

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  
  const user = await authenticateUser(username, password);
  
  if (user) {
    captureSecurityEvents.loginSuccess(username, ip);
    return Response.json({ ok: true, token: generateToken(user) });
  } else {
    captureSecurityEvents.loginFailed(
      username,
      ip,
      'Invalid credentials'
    );
    return Response.json({ ok: false }, { status: 401 });
  }
}
```

---

## 🔍 Recherche Avancée

### Rechercher tous les logs critiques du dernier jour

```typescript
const recentCritical = logger.searchLogs({
  level: 'critical',
  dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000)
});
```

### Rechercher accès non autorisé

```typescript
const securityEvents = logger.searchLogs({
  category: 'security',
  search: 'unauthorized'
});
```

### Rechercher actions d'un utilisateur spécifique

```typescript
const userActions = logger.searchLogs({
  username: 'john.doe',
  category: 'action'
});
```

---

## 📊 Statistiques

```typescript
const stats = logger.getStats();
// {
//   totalLogs: 1524,
//   systemLogs: 456,
//   userLogs: 234,
//   actionLogs: 567,
//   securityLogs: 267,
//   criticalCount: 12,
//   errorCount: 89,
//   warningCount: 234,
//   lastLogTime: Date
// }
```

---

## 🛡️ Bonnes Pratiques

1. **Loggez les événements importants** - Ne loggez pas chaque ping
2. **Utilisez les bons niveaux** - 'warning' pour anomalies, 'critical' pour outages
3. **Incluez le contexte** - Utilisez `details` pour info additionnelles
4. **Tracez les utilisateurs** - Toujours capturer `username` et `ipSource`
5. **Archivez régulièrement** - Purgez les logs > 30 jours
6. **Monitoring des logs** - Alerter sur logs 'critical'

---

## 🚀 Prochaines Étapes

- [ ] Migration vers PostgreSQL/MongoDB pour production
- [ ] Webhooks pour alertes sur events critiques
- [ ] Correlation ID pour tracer transactions multi-services
- [ ] Export vers syslog/ELK Stack
- [ ] Dashboards grafana
- [ ] Audit trails signés cryptographiquement
- [ ] Rétention configurable par catégorie
- [ ] Chiffrement des données sensibles dans les logs

---

## 📞 Support

Pour des exemples spécifiques ou aide à l'intégration:
- Consultez `/logs/test` pour les scénarios de test
- Consultez `/logs/integration-guide` pour les patterns
- Vérifiez `LOGGING_EXAMPLES.ts` pour les cas d'usage
