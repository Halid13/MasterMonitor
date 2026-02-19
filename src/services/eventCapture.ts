import { logger } from './logger';

/**
 * Capture les événements système réels
 * Cette fonction est appelée lors du polling des métriques
 */
export const captureSystemEvents = {
  /**
   * Log quand un serveur change de statut
   */
  serverStatusChanged: (
    serverId: string,
    serverName: string,
    oldStatus: 'online' | 'offline' | 'warning',
    newStatus: 'online' | 'offline' | 'warning',
    reason?: string
  ) => {
    const level = newStatus === 'offline' ? 'critical' : newStatus === 'warning' ? 'warning' : 'info';
    
    logger.logSystem(
      `Server Status Changed: ${oldStatus.toUpperCase()} → ${newStatus.toUpperCase()}`,
      `${serverName} (${serverId})`,
      level,
      {
        reason,
        severity: level,
        timestamp: new Date().toISOString(),
      },
      oldStatus,
      newStatus
    );
  },

  /**
   * Log quand les métriques d'un serveur changent significativement
   */
  metricsAnomalyDetected: (
    serverId: string,
    serverName: string,
    metric: string,
    value: number,
    threshold: number
  ) => {
    const level = value > threshold * 0.9 ? 'critical' : 'warning';
    
    logger.logSystem(
      `Anomaly Detected: ${metric} exceeds threshold`,
      `${serverName} (${serverId})`,
      level,
      {
        metric,
        value: `${value.toFixed(2)}%`,
        threshold: `${threshold}%`,
        percentOfThreshold: `${((value / threshold) * 100).toFixed(2)}%`,
      }
    );
  },

  /**
   * Log quand un service démarre/s'arrête
   */
  serviceStateChanged: (
    serverId: string,
    serverName: string,
    serviceName: string,
    oldState: string,
    newState: string
  ) => {
    const level = newState === 'stopped' ? 'warning' : 'info';
    
    logger.logSystem(
      `Service State Changed: ${oldState.toUpperCase()} → ${newState.toUpperCase()}`,
      `${serviceName} on ${serverName}`,
      level,
      {
        service: serviceName,
        server: serverName,
        serverId,
      },
      oldState,
      newState
    );
  },

  /**
   * Log quand un service check est effectué
   */
  healthCheckPerformed: (
    serverId: string,
    serverName: string,
    healthScore: number,
    previousScore?: number
  ) => {
    const scoreChange = previousScore ? healthScore - previousScore : 0;
    const scoreChangeStr = scoreChange > 0 ? `↑ +${scoreChange.toFixed(2)}` : scoreChange < 0 ? `↓ ${scoreChange.toFixed(2)}` : 'unchanged';
    
    logger.logSystem(
      `Health Check: Score ${scoreChangeStr}`,
      `${serverName} (${serverId})`,
      'info',
      {
        healthScore: `${healthScore.toFixed(2)}/100`,
        previousScore: previousScore ? `${previousScore.toFixed(2)}/100` : 'N/A',
        change: scoreChangeStr,
      }
    );
  },

  /**
   * Log quand le système détecte un problème de connectivité
   */
  connectivityIssue: (
    serverId: string,
    serverName: string,
    connectionType: string,
    error: string
  ) => {
    logger.logSecurity(
      `Connectivity Issue Detected`,
      `${serverName} (${serverId}) - ${connectionType}`,
      'error',
      undefined,
      undefined,
      {
        connectionType,
        error,
        server: serverName,
        serverId,
      }
    );
  },

  /**
   * Log quand le backup status change
   */
  backupStatusChanged: (
    serverId: string,
    serverName: string,
    oldStatus: string,
    newStatus: string,
    backupTime?: string
  ) => {
    logger.logSystem(
      `Backup Status Changed: ${oldStatus} → ${newStatus}`,
      `${serverName} (${serverId})`,
      'info',
      {
        backupTime,
      },
      oldStatus,
      newStatus
    );
  },

  /**
   * Log quand l'antivirus status change
   */
  antivirusStatusChanged: (
    serverId: string,
    serverName: string,
    oldStatus: string,
    newStatus: string,
    lastScanDate?: string
  ) => {
    const level = newStatus === 'inactive' ? 'critical' : newStatus === 'warning' ? 'warning' : 'info';
    
    logger.logSecurity(
      `Antivirus Status Changed: ${oldStatus} → ${newStatus}`,
      `${serverName} (${serverId})`,
      level,
      undefined,
      undefined,
      {
        lastScanDate,
        oldStatus,
        newStatus,
      }
    );
  },

  /**
   * Log quand une maintenance window commence/finit
   */
  maintenanceWindowEvent: (
    serverId: string,
    serverName: string,
    eventType: 'start' | 'end',
    reason?: string
  ) => {
    logger.logAction(
      eventType === 'start' ? 'start' : 'stop',
      'MaintenanceWindow',
      `${serverId}`,
      undefined,
      'info',
      undefined,
      undefined,
      {
        server: serverName,
        reason,
      }
    );
  },

  /**
   * Log quand uptime/restart est détecté
   */
  uptimeEvent: (
    serverId: string,
    serverName: string,
    eventType: 'reboot' | 'shutdown' | 'startup',
    uptime: number
  ) => {
    const level = eventType === 'reboot' ? 'warning' : 'info';
    
    logger.logSystem(
      `Server ${eventType.toUpperCase()}: Uptime reset`,
      `${serverName} (${serverId})`,
      level,
      {
        uptimeDays: (uptime / (1000 * 60 * 60 * 24)).toFixed(2),
        eventType,
      }
    );
  },
};
