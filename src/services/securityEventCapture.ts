import { logger } from './logger';

/**
 * Capture les événements de sécurité
 */
export const captureSecurityEvents = {
  /**
   * Log tentative de connexion réussie
   */
  loginSuccess: (
    username: string,
    ipSource: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      'Successful Login',
      username,
      'info',
      username,
      ipSource,
      {
        ...details,
        timestamp: new Date().toISOString(),
      }
    );
  },

  /**
   * Log tentative de connexion échouée
   */
  loginFailed: (
    username: string,
    ipSource: string,
    reason: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      'Failed Login Attempt',
      username,
      'warning',
      username,
      ipSource,
      {
        reason,
        ...details,
        timestamp: new Date().toISOString(),
      }
    );
  },

  /**
   * Log déconnexion
   */
  logoutEvent: (
    username: string,
    ipSource: string,
    sessionDuration?: number
  ) => {
    logger.logSecurity(
      'User Logout',
      username,
      'info',
      username,
      ipSource,
      {
        sessionDurationMs: sessionDuration,
        sessionDurationMin: sessionDuration ? (sessionDuration / 60000).toFixed(2) : undefined,
      }
    );
  },

  /**
   * Log accès non autorisé
   */
  unauthorizedAccess: (
    username: string,
    resource: string,
    ipSource: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      'Unauthorized Access Attempt',
      `${username} → ${resource}`,
      'error',
      username,
      ipSource,
      {
        ...details,
        timestamp: new Date().toISOString(),
      }
    );
  },

  /**
   * Log changement de permissions/rôle
   */
  permissionChanged: (
    targetUser: string,
    oldRole: string,
    newRole: string,
    changedBy: string,
    ipSource?: string,
    reason?: string
  ) => {
    logger.logSecurity(
      `User Role Changed: ${oldRole} → ${newRole}`,
      targetUser,
      'warning',
      changedBy,
      ipSource,
      {
        reason,
      }
    );
  },

  /**
   * Log accès à des données sensibles
   */
  sensitiveDataAccessed: (
    username: string,
    dataType: string,
    recordsAccessed: number,
    ipSource: string,
    purpose?: string
  ) => {
    logger.logSecurity(
      `Sensitive Data Access: ${dataType}`,
      `${recordsAccessed} records`,
      'warning',
      username,
      ipSource,
      {
        dataType,
        recordsAccessed,
        purpose,
      }
    );
  },

  /**
   * Log modification de données sensibles
   */
  sensitiveDataModified: (
    username: string,
    dataType: string,
    recordId: string,
    oldValue: any,
    newValue: any,
    ipSource: string,
    reason?: string
  ) => {
    logger.logSecurity(
      `Sensitive Data Modified: ${dataType}`,
      recordId,
      'warning',
      username,
      ipSource,
      {
        dataType,
        oldValue,
        newValue,
        reason,
      }
    );
  },

  /**
   * Log suppression de données sensibles
   */
  sensitiveDataDeleted: (
    username: string,
    dataType: string,
    recordId: string,
    deletedData?: any,
    ipSource?: string,
    reason?: string
  ) => {
    logger.logSecurity(
      `Sensitive Data Deleted: ${dataType}`,
      recordId,
      'critical',
      username,
      ipSource,
      {
        dataType,
        deletedData,
        reason,
      }
    );
  },

  /**
   * Log accès à des fichiers système
   */
  systemFileAccessed: (
    username: string,
    filePath: string,
    accessType: 'read' | 'write' | 'execute' | 'delete',
    ipSource: string,
    reason?: string
  ) => {
    logger.logSecurity(
      `System File ${accessType.toUpperCase()}: ${filePath}`,
      filePath,
      'warning',
      username,
      ipSource,
      {
        accessType,
        reason,
      }
    );
  },

  /**
   * Log anomalie de sécurité détectée
   */
  securityAnomalyDetected: (
    anomalyType: string,
    severity: 'warning' | 'error' | 'critical',
    description: string,
    details?: Record<string, any>,
    ipSource?: string
  ) => {
    logger.logSecurity(
      `Security Anomaly Detected: ${anomalyType}`,
      description,
      severity,
      undefined,
      ipSource,
      details
    );
  },

  /**
   * Log tentative d'escalade de privilèges
   */
  privilegeEscalationAttempt: (
    username: string,
    ipSource: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      'Privilege Escalation Attempt',
      username,
      'critical',
      username,
      ipSource,
      details
    );
  },

  /**
   * Log violation de politique de sécurité
   */
  securityPolicyViolation: (
    username: string,
    policyName: string,
    violationType: string,
    ipSource: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      `Security Policy Violation: ${policyName}`,
      `${username} - ${violationType}`,
      'warning',
      username,
      ipSource,
      details
    );
  },

  /**
   * Log suspension de compte
   */
  accountSuspended: (
    username: string,
    reason: string,
    suspendedBy: string,
    ipSource?: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      'Account Suspended',
      username,
      'critical',
      suspendedBy,
      ipSource,
      {
        reason,
        ...details,
      }
    );
  },

  /**
   * Log activation de compte
   */
  accountActivated: (
    username: string,
    activatedBy: string,
    ipSource?: string
  ) => {
    logger.logSecurity(
      'Account Activated',
      username,
      'info',
      activatedBy,
      ipSource
    );
  },

  /**
   * Log réinitialisation de mot de passe
   */
  passwordReset: (
    username: string,
    resetBy: string,
    ipSource: string,
    reason?: string
  ) => {
    logger.logSecurity(
      'Password Reset',
      username,
      'warning',
      resetBy,
      ipSource,
      { reason }
    );
  },

  /**
   * Log tentative de brute force détectée
   */
  bruteForceDetected: (
    targetUsername: string,
    attemptCount: number,
    ipSource: string,
    timeWindow: number
  ) => {
    logger.logSecurity(
      `Brute Force Attack Detected`,
      `${attemptCount} attempts from ${ipSource}`,
      'critical',
      undefined,
      ipSource,
      {
        targetUsername,
        attemptCount,
        timeWindowMs: timeWindow,
        timeWindowMin: (timeWindow / 60000).toFixed(2),
      }
    );
  },

  /**
   * Log accès VPN/distant
   */
  remoteAccessInitiated: (
    username: string,
    accessType: string,
    sourceIp: string,
    targetResource: string,
    details?: Record<string, any>
  ) => {
    logger.logSecurity(
      `Remote Access: ${accessType}`,
      `${username} → ${targetResource}`,
      'warning',
      username,
      sourceIp,
      details
    );
  },

  /**
   * Log export/téléchargement de données
   */
  dataExportedSecurity: (
    username: string,
    dataType: string,
    recordCount: number,
    ipSource: string,
    reason?: string
  ) => {
    logger.logSecurity(
      `Data Export: ${dataType}`,
      `${recordCount} records`,
      'warning',
      username,
      ipSource,
      { reason }
    );
  },
};
