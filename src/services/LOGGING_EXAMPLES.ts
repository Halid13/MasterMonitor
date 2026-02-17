/**
 * EXEMPLES D'UTILISATION DU SYSTÈME DE LOGGING
 * 
 * Ce fichier montre comment utiliser les 4 modules de capture de logs:
 * 1. logger - Pour logs basiques
 * 2. captureSystemEvents - Pour événements système
 * 3. captureUserActions - Pour actions utilisateur (CRUD)
 * 4. captureSecurityEvents - Pour événements de sécurité
 */

// ===== 1. LOGS SYSTÈME =====
// Utilisez le logger principal pour les événements système génériques

import { logger } from '@/services/logger';

// Log système simple
logger.logSystem(
  'Database Connection Timeout',
  'Primary-DB-Server',
  'warning',
  {
    connectionType: 'SQL Server',
    timeout: '30s',
    retries: 3,
  },
  'connected',
  'timeout'
);

// ===== 2. ÉVÉNEMENTS SYSTÈME =====
// Utilisez captureSystemEvents pour les événements automatisés et métriques

import { captureSystemEvents } from '@/services/eventCapture';

// Quand un serveur change de statut
captureSystemEvents.serverStatusChanged(
  'srv-001',
  'Production-Web-Server',
  'online',
  'offline',
  'Network interface down'
);

// Quand des métriques anomales sont détectées
captureSystemEvents.metricsAnomalyDetected(
  'srv-app-01',
  'Application-Server-01',
  'CPU',
  95.2,
  80 // threshold
);

// Lors d'un health check
captureSystemEvents.healthCheckPerformed(
  'srv-001',
  'Server-01',
  82.5, // current score
  85.0  // previous score
);

// Quand un service démarre/s'arrête
captureSystemEvents.serviceStateChanged(
  'srv-web-01',
  'Web-Server-01',
  'IIS',
  'running',
  'stopped'
);

// ===== 3. ACTIONS UTILISATEUR =====
// Utilisez captureUserActions pour toutes les opérations CRUD

import { captureUserActions } from '@/services/userActionCapture';

// Création d'un serveur
captureUserActions.serverCreated(
  'srv-new-prod-01',
  'New-Production-Server',
  'admin@monitor.local',
  {
    group: 'production',
    sla: 'critique',
    owner: 'ops-team',
  }
);

// Modification d'un serveur
captureUserActions.serverModified(
  'srv-001',
  'Server-01',
  'technician@monitor.local',
  {
    sla: 'important', // Changed from 'standard'
    owner: 'john.doe@company.com',
    description: 'Updated SLA and owner',
  },
  {
    sla: 'standard',
    owner: 'previous.owner@company.com',
  }
);

// Suppression d'un serveur
captureUserActions.serverDeleted(
  'srv-old-001',
  'Old-Server',
  'admin@monitor.local',
  'End of life - replacement completed'
);

// Création d'un ticket
captureUserActions.ticketCreated(
  'tkt-2024-001',
  'Server-01 experiencing high CPU load',
  'user@monitor.local',
  {
    priority: 'high',
    category: 'performance',
    assignedTo: 'senior-tech@monitor.local',
  }
);

// Modification d'un ticket
captureUserActions.ticketModified(
  'tkt-2024-001',
  'Server-01 experiencing high CPU load',
  'technician@monitor.local',
  {
    status: 'in-progress',
    notes: 'Identified rogue process',
  },
  {
    status: 'open',
  }
);

// Fermeture d'un ticket
captureUserActions.ticketClosed(
  'tkt-2024-001',
  'Server-01 experiencing high CPU load',
  'technician@monitor.local',
  'Terminated runaway process - server performance normalized'
);

// Création d'un équipement
captureUserActions.equipmentCreated(
  'eq-laptop-001',
  'HP ProBook 450',
  'laptop',
  'admin@monitor.local',
  {
    serialNumber: 'SN123456',
    assignedTo: 'john.doe',
    department: 'Sales',
  }
);

// Export de données
captureUserActions.dataExported(
  'Servers',
  'CSV',
  'manager@monitor.local',
  156
);

// ===== 4. ÉVÉNEMENTS SÉCURITÉ =====
// Utilisez captureSecurityEvents pour tous les événements de sécurité

import { captureSecurityEvents } from '@/services/securityEventCapture';

// Connexion réussie
captureSecurityEvents.loginSuccess(
  'john.doe',
  '192.168.1.100'
);

// Tentative de connexion échouée
captureSecurityEvents.loginFailed(
  'admin',
  '192.168.1.105',
  'Invalid credentials - 3 failed attempts'
);

// Déconnexion
captureSecurityEvents.logoutEvent(
  'john.doe',
  '192.168.1.100',
  3600000 // 1 hour session
);

// Accès non autorisé
captureSecurityEvents.unauthorizedAccess(
  'regular-user',
  '/api/admin/settings',
  '192.168.1.110'
);

// Changement de permissions
captureSecurityEvents.permissionChanged(
  'jane.smith',
  'technician',
  'manager',
  'admin@monitor.local',
  '192.168.1.100',
  'Promotion due to performance'
);

// Données sensibles modifiées
captureSecurityEvents.sensitiveDataModified(
  'admin@monitor.local',
  'AdminPassword',
  'user-001',
  'old_hashed_password',
  'new_hashed_password',
  '192.168.1.100',
  'Scheduled password rotation'
);

// Anomalie de sécurité détectée
captureSecurityEvents.securityAnomalyDetected(
  'SQL Injection Attempt',
  'critical',
  'Malformed SQL query detected in API request',
  {
    endpoint: '/api/search',
    payload: 'sensitive_data_redacted',
    detectionMethod: 'WAF Rule 001',
  },
  '192.168.1.200'
);

// Tentative d'escalade de privilèges
captureSecurityEvents.privilegeEscalationAttempt(
  'suspicious-user',
  '192.168.1.150'
);

// Violation de politique de sécurité
captureSecurityEvents.securityPolicyViolation(
  'john.doe',
  'Data Classification Policy',
  'Attempted to export confidential data outside secure channel',
  '192.168.1.100'
);

// Détection de brute force
captureSecurityEvents.bruteForceDetected(
  'admin',
  15, // attempts
  '192.168.1.200',
  300000 // 5 minutes
);

// Accès VPN/distant
captureSecurityEvents.remoteAccessInitiated(
  'john.doe',
  'VPN',
  '203.0.113.42',
  'Production Database',
  {
    vpnGateway: 'vpn.company.com',
    duration: '2 hours',
  }
);

// ===== RECHERCHE DE LOGS =====
const systemLogs = logger.searchLogs({
  category: 'system',
  level: 'warning',
  dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
});

const recentSecurityEvents = logger.searchLogs({
  category: 'security',
  search: 'login',
});

// ===== STATISTIQUES =====
const stats = logger.getStats();
console.log(`Total logs: ${stats.totalLogs}`);
console.log(`Critical events: ${stats.criticalCount}`);
console.log(`Errors: ${stats.errorCount}`);

// ===== PURGE DES LOGS =====
const purgedCount = logger.purgeLogs(7); // Keep last 7 days
console.log(`Purged ${purgedCount} old logs`);
