import { SystemLog, LogLevel } from '@/types';

const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6_REGEX = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/;

const normalizeIp = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const noMappedPrefix = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  if (noMappedPrefix === '::1' || noMappedPrefix === '127.0.0.1' || noMappedPrefix === 'localhost') {
    return undefined;
  }
  return noMappedPrefix;
};

const extractIpFromText = (text?: string) => {
  if (!text) return undefined;
  const ipv4 = text.match(IPV4_REGEX)?.[0];
  const normalized4 = normalizeIp(ipv4);
  if (normalized4) return normalized4;
  const ipv6 = text.match(IPV6_REGEX)?.[0];
  const normalized6 = normalizeIp(ipv6);
  if (normalized6) return normalized6;
  return undefined;
};

const inferIpSource = (ipSource?: string, objectImpacted?: string, details?: Record<string, any>) => {
  const explicit = normalizeIp(ipSource);
  if (explicit) return explicit;

  const directCandidates = [
    details?.ip,
    details?.ipAddress,
    details?.sourceIp,
    details?.targetIp,
    details?.deviceIp,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeIp(typeof candidate === 'string' ? candidate : undefined);
    if (normalized) return normalized;
  }

  const fromObject = extractIpFromText(objectImpacted);
  if (fromObject) return fromObject;

  if (details) {
    const fromDetails = extractIpFromText(JSON.stringify(details));
    if (fromDetails) return fromDetails;
  }

  return undefined;
};

// Simple in-memory log storage
let logs: SystemLog[] = [];
const MAX_LOGS = 10000;

// Event listeners
type LogListener = (log: SystemLog) => void;
const listeners: Set<LogListener> = new Set();

export const logger = {
  /**
   * Log système: Événements techniques du système (démarrage services, changements métriques, etc.)
   */
  logSystem: (
    action: string,
    objectImpacted: string,
    level: LogLevel = 'info',
    details?: Record<string, any>,
    oldValue?: string,
    newValue?: string,
  ) => {
    const resolvedIp = inferIpSource(undefined, objectImpacted, details);
    const log: SystemLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      category: 'system',
      level,
      module: 'System',
      action,
      objectImpacted,
      oldValue,
      newValue,
      ipSource: resolvedIp,
      details,
    };
    addLog(log);
    return log;
  },

  /**
   * Log utilisateur: Authentification, connexions, changements profil
   */
  logUser: (
    action: string,
    objectImpacted: string,
    username: string,
    level: LogLevel = 'info',
    ipSource?: string,
    details?: Record<string, any>,
  ) => {
    const resolvedIp = inferIpSource(ipSource, objectImpacted, details);
    const log: SystemLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      category: 'user',
      level,
      username,
      module: 'User',
      action,
      objectImpacted,
      ipSource: resolvedIp,
      details,
    };
    addLog(log);
    return log;
  },

  /**
   * Log action: CRUD sur serveurs, équipements, tickets, etc.
   */
  logAction: (
    action: 'create' | 'update' | 'delete' | 'modify' | 'start' | 'stop' | 'restart',
    objectType: string,
    objectId: string,
    username?: string,
    level: LogLevel = 'info',
    oldValue?: string,
    newValue?: string,
    details?: Record<string, any>,
    ipSource?: string,
  ) => {
    const resolvedIp = inferIpSource(ipSource, objectId, details);
    const log: SystemLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      category: 'action',
      level,
      username,
      module: objectType,
      action: `${action.toUpperCase()} ${objectType}`,
      objectImpacted: objectId,
      oldValue,
      newValue,
      ipSource: resolvedIp,
      details,
    };
    addLog(log);
    return log;
  },

  /**
   * Log sécurité: Authentification échouée, accès non autorisé, changements critiques
   */
  logSecurity: (
    action: string,
    objectImpacted: string,
    level: LogLevel = 'warning',
    username?: string,
    ipSource?: string,
    details?: Record<string, any>,
  ) => {
    const resolvedIp = inferIpSource(ipSource, objectImpacted, details);
    const log: SystemLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      category: 'security',
      level,
      username,
      module: 'Security',
      action,
      objectImpacted,
      ipSource: resolvedIp,
      details,
    };
    addLog(log);
    return log;
  },

  /**
   * Ajouter un écouteur pour les nouveaux logs
   */
  subscribe: (listener: LogListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Obtenir tous les logs
   */
  getLogs: () => [...logs],

  /**
   * Ajouter un log manuellement
   */
  addLog: addLog,

  /**
   * Effacer les anciens logs (avec cutoff date)
   */
  purgeLogs: (daysToKeep: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const initialCount = logs.length;
    logs = logs.filter((log) => log.timestamp > cutoffDate);
    const purgedCount = initialCount - logs.length;
    
    logger.logSystem(
      'PURGE',
      'Logs',
      'info',
      { purgedCount, remainingCount: logs.length },
    );
    
    return purgedCount;
  },

  /**
   * Vider tous les logs
   */
  clearLogs: () => {
    logs = [];
  },

  /**
   * Chercher des logs avec filtres
   */
  searchLogs: (filters: {
    category?: string;
    level?: string;
    module?: string;
    username?: string;
    action?: string;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => {
    let results = [...logs];

    if (filters.category) {
      results = results.filter((log) => log.category === filters.category);
    }
    if (filters.level) {
      results = results.filter((log) => log.level === filters.level);
    }
    if (filters.module) {
      results = results.filter((log) => log.module === filters.module);
    }
    if (filters.username) {
      results = results.filter((log) => log.username === filters.username);
    }
    if (filters.action) {
      results = results.filter((log) => log.action.includes(filters.action!));
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(
        (log) =>
          log.action.toLowerCase().includes(searchLower) ||
          log.objectImpacted.toLowerCase().includes(searchLower) ||
          log.module.toLowerCase().includes(searchLower) ||
          log.username?.toLowerCase().includes(searchLower),
      );
    }
    if (filters.dateFrom) {
      results = results.filter((log) => log.timestamp >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      results = results.filter((log) => log.timestamp <= filters.dateTo!);
    }

    return results;
  },

  /**
   * Obtenir les statistiques des logs
   */
  getStats: () => {
    const stats = {
      totalLogs: logs.length,
      systemLogs: logs.filter((l) => l.category === 'system').length,
      userLogs: logs.filter((l) => l.category === 'user').length,
      actionLogs: logs.filter((l) => l.category === 'action').length,
      securityLogs: logs.filter((l) => l.category === 'security').length,
      criticalCount: logs.filter((l) => l.level === 'critical').length,
      errorCount: logs.filter((l) => l.level === 'error').length,
      warningCount: logs.filter((l) => l.level === 'warning').length,
      lastLogTime: logs.length > 0 ? logs[0].timestamp : undefined,
    };
    return stats;
  },
};

// Internal function to add log
function addLog(log: SystemLog) {
  logs = [log, ...logs].slice(0, MAX_LOGS);
  
  // Notify listeners
  listeners.forEach((listener) => {
    try {
      listener(log);
    } catch (error) {
      console.error('Error in log listener:', error);
    }
  });
}

// Auto-subscribe for console logging in development
if (process.env.NODE_ENV === 'development') {
  logger.subscribe((log) => {
    const colors = {
      system: '\x1b[36m',    // Cyan
      user: '\x1b[33m',      // Yellow
      action: '\x1b[34m',    // Blue
      security: '\x1b[31m',  // Red
      reset: '\x1b[0m',
    };
    const color = colors[log.category as keyof typeof colors] || colors.system;
    console.log(
      `${color}[${log.category.toUpperCase()}]${colors.reset} ${log.action} - ${log.objectImpacted}`,
    );
  });
}
