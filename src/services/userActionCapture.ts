import { logger } from './logger';

/**
 * Capture les actions utilisateur (CRUD operations)
 */
export const captureUserActions = {
  /**
   * Log création d'un serveur
   */
  serverCreated: (
    serverId: string,
    serverName: string,
    username: string,
    details?: Record<string, any>
  ) => {
    logger.logAction(
      'create',
      'Server',
      serverId,
      username,
      'info',
      undefined,
      JSON.stringify({
        name: serverName,
        ...details,
      }),
      details
    );
  },

  /**
   * Log modification d'un serveur
   */
  serverModified: (
    serverId: string,
    serverName: string,
    username: string,
    changes: Record<string, any>,
    oldValues?: Record<string, any>
  ) => {
    const changesSummary = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    logger.logAction(
      'update',
      'Server',
      serverId,
      username,
      'info',
      JSON.stringify(oldValues || {}),
      JSON.stringify(changes),
      {
        name: serverName,
        changedFields: Object.keys(changes),
        summary: changesSummary,
      }
    );
  },

  /**
   * Log suppression d'un serveur
   */
  serverDeleted: (
    serverId: string,
    serverName: string,
    username: string,
    reason?: string
  ) => {
    logger.logAction(
      'delete',
      'Server',
      serverId,
      username,
      'warning',
      JSON.stringify({ name: serverName }),
      undefined,
      {
        reason,
      }
    );
  },

  /**
   * Log création d'un utilisateur
   */
  userCreated: (
    userId: string,
    username: string,
    createdBy: string,
    details?: Record<string, any>
  ) => {
    logger.logUser(
      'CREATE',
      username,
      createdBy,
      'info',
      undefined,
      details
    );
  },

  /**
   * Log modification d'un utilisateur
   */
  userModified: (
    userId: string,
    username: string,
    modifiedBy: string,
    changes: Record<string, any>,
    oldValues?: Record<string, any>
  ) => {
    const changesSummary = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    logger.logUser(
      'UPDATE',
      username,
      modifiedBy,
      'info',
      undefined,
      {
        changedFields: Object.keys(changes),
        summary: changesSummary,
        changes,
        oldValues,
      }
    );
  },

  /**
   * Log suppression d'un utilisateur
   */
  userDeleted: (
    userId: string,
    username: string,
    deletedBy: string,
    reason?: string
  ) => {
    logger.logUser(
      'DELETE',
      username,
      deletedBy,
      'warning',
      undefined,
      { reason }
    );
  },

  /**
   * Log création d'un ticket
   */
  ticketCreated: (
    ticketId: string,
    title: string,
    createdBy: string,
    details?: Record<string, any>
  ) => {
    logger.logAction(
      'create',
      'Ticket',
      ticketId,
      createdBy,
      'info',
      undefined,
      JSON.stringify({
        title,
        ...details,
      }),
      { ...details, title }
    );
  },

  /**
   * Log modification d'un ticket
   */
  ticketModified: (
    ticketId: string,
    title: string,
    modifiedBy: string,
    changes: Record<string, any>,
    oldValues?: Record<string, any>
  ) => {
    const changesSummary = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    logger.logAction(
      'update',
      'Ticket',
      ticketId,
      modifiedBy,
      'info',
      JSON.stringify(oldValues || {}),
      JSON.stringify(changes),
      {
        title,
        changedFields: Object.keys(changes),
        summary: changesSummary,
      }
    );
  },

  /**
   * Log fermeture d'un ticket
   */
  ticketClosed: (
    ticketId: string,
    title: string,
    closedBy: string,
    resolution?: string
  ) => {
    logger.logAction(
      'stop',
      'Ticket',
      ticketId,
      closedBy,
      'info',
      'open',
      'closed',
      {
        title,
        resolution,
      }
    );
  },

  /**
   * Log création d'un équipement
   */
  equipmentCreated: (
    equipmentId: string,
    equipmentName: string,
    equipmentType: string,
    createdBy: string,
    details?: Record<string, any>
  ) => {
    logger.logAction(
      'create',
      'Equipment',
      equipmentId,
      createdBy,
      'info',
      undefined,
      JSON.stringify({
        name: equipmentName,
        type: equipmentType,
        ...details,
      }),
      { ...details, name: equipmentName, type: equipmentType }
    );
  },

  /**
   * Log modification d'un équipement
   */
  equipmentModified: (
    equipmentId: string,
    equipmentName: string,
    modifiedBy: string,
    changes: Record<string, any>,
    oldValues?: Record<string, any>
  ) => {
    const changesSummary = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    logger.logAction(
      'update',
      'Equipment',
      equipmentId,
      modifiedBy,
      'info',
      JSON.stringify(oldValues || {}),
      JSON.stringify(changes),
      {
        name: equipmentName,
        changedFields: Object.keys(changes),
        summary: changesSummary,
      }
    );
  },

  /**
   * Log suppression d'un équipement
   */
  equipmentDeleted: (
    equipmentId: string,
    equipmentName: string,
    deletedBy: string,
    reason?: string
  ) => {
    logger.logAction(
      'delete',
      'Equipment',
      equipmentId,
      deletedBy,
      'warning',
      JSON.stringify({ name: equipmentName }),
      undefined,
      { reason }
    );
  },

  /**
   * Log export de données
   */
  dataExported: (
    dataType: string,
    format: string,
    exportedBy: string,
    recordCount: number
  ) => {
    logger.logAction(
      'create',
      'DataExport',
      `${dataType}-${format}-${Date.now()}`,
      exportedBy,
      'info',
      undefined,
      undefined,
      {
        dataType,
        format,
        recordCount,
      }
    );
  },

  /**
   * Log import de données
   */
  dataImported: (
    dataType: string,
    importedBy: string,
    recordCount: number
  ) => {
    logger.logAction(
      'create',
      'DataImport',
      `${dataType}-${Date.now()}`,
      importedBy,
      'info',
      undefined,
      undefined,
      {
        dataType,
        recordCount,
      }
    );
  },

  /**
   * Log configuration change
   */
  configurationChanged: (
    configKey: string,
    oldValue: any,
    newValue: any,
    changedBy: string,
    reason?: string
  ) => {
    logger.logAction(
      'modify',
      'Configuration',
      configKey,
      changedBy,
      'warning',
      JSON.stringify(oldValue),
      JSON.stringify(newValue),
      {
        reason,
      }
    );
  },
};
