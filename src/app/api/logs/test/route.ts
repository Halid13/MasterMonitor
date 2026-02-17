import { NextResponse } from 'next/server';
import { logger } from '@/services/logger';
import { captureSystemEvents } from '@/services/eventCapture';
import { captureUserActions } from '@/services/userActionCapture';
import { captureSecurityEvents } from '@/services/securityEventCapture';

/**
 * API endpoint pour générer des logs de test
 * Utile pour démonstration et test du système de logging
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // Actions système
    if (action === 'server-status-changed') {
      captureSystemEvents.serverStatusChanged(
        params.serverId || 'srv-001',
        params.serverName || 'Database-Server',
        params.oldStatus || 'online',
        params.newStatus || 'offline',
        params.reason
      );
      return NextResponse.json({ ok: true, message: 'Server status log created' });
    }

    if (action === 'metrics-anomaly') {
      captureSystemEvents.metricsAnomalyDetected(
        params.serverId || 'srv-001',
        params.serverName || 'Database-Server',
        params.metric || 'CPU',
        params.value || 92.5,
        params.threshold || 80
      );
      return NextResponse.json({ ok: true, message: 'Metrics anomaly log created' });
    }

    if (action === 'service-state-changed') {
      captureSystemEvents.serviceStateChanged(
        params.serverId || 'srv-001',
        params.serverName || 'Web-Server',
        params.serviceName || 'IIS',
        params.oldState || 'running',
        params.newState || 'stopped'
      );
      return NextResponse.json({ ok: true, message: 'Service state log created' });
    }

    if (action === 'health-check') {
      captureSystemEvents.healthCheckPerformed(
        params.serverId || 'srv-001',
        params.serverName || 'Server-01',
        params.healthScore || 85.5,
        params.previousScore || 88.2
      );
      return NextResponse.json({ ok: true, message: 'Health check log created' });
    }

    // Actions utilisateur
    if (action === 'server-created') {
      captureUserActions.serverCreated(
        params.serverId || 'srv-new-001',
        params.serverName || 'New-Server',
        params.username || 'admin',
        params.details
      );
      return NextResponse.json({ ok: true, message: 'Server creation log created' });
    }

    if (action === 'server-modified') {
      captureUserActions.serverModified(
        params.serverId || 'srv-001',
        params.serverName || 'Server-01',
        params.username || 'technician',
        params.changes || { sla: 'important', owner: 'john.doe' },
        params.oldValues
      );
      return NextResponse.json({ ok: true, message: 'Server modification log created' });
    }

    if (action === 'ticket-created') {
      captureUserActions.ticketCreated(
        params.ticketId || 'tkt-001',
        params.title || 'Server is down',
        params.createdBy || 'user@monitor.local',
        params.details || { priority: 'critical', category: 'hardware' }
      );
      return NextResponse.json({ ok: true, message: 'Ticket creation log created' });
    }

    // Événements sécurité
    if (action === 'login-success') {
      captureSecurityEvents.loginSuccess(
        params.username || 'admin',
        params.ipSource || '192.168.1.100'
      );
      return NextResponse.json({ ok: true, message: 'Login success log created' });
    }

    if (action === 'login-failed') {
      captureSecurityEvents.loginFailed(
        params.username || 'admin',
        params.ipSource || '192.168.1.105',
        params.reason || 'Invalid credentials'
      );
      return NextResponse.json({ ok: true, message: 'Login failed log created' });
    }

    if (action === 'unauthorized-access') {
      captureSecurityEvents.unauthorizedAccess(
        params.username || 'user',
        params.resource || '/admin/panel',
        params.ipSource || '192.168.1.110'
      );
      return NextResponse.json({ ok: true, message: 'Unauthorized access log created' });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to create test log' },
      { status: 500 }
    );
  }
}

/**
 * GET pour obtenir les statistics des logs
 */
export async function GET() {
  try {
    const stats = logger.getStats();
    return NextResponse.json({
      ok: true,
      stats,
      logs: logger.getLogs().slice(0, 50), // Return last 50 logs
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
