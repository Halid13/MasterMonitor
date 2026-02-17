/**
 * GUIDE D'INTÉGRATION DES LOGS DANS VOS PAGES EXISTANTES
 * 
 * Ce fichier montre comment intégrer les logs dans:
 * - Page Serveurs (create/update/delete)
 * - Page Utilisateurs
 * - Page Tickets
 * - API d'authentification
 * - Polling des métriques
 */

// ============================================================
// EXEMPLE 1: Intégration dans src/app/servers/page.tsx
// ============================================================

/*
'use client';

import { captureUserActions } from '@/services/userActionCapture';
import { captureSystemEvents } from '@/services/eventCapture';

export default function ServersPage() {
  // ... existing code ...

  // Fonction de création de serveur
  const handleCreateServer = async (formData: ServerFormData) => {
    try {
      // Créer le serveur
      const serverId = 'srv-' + Date.now();
      const newServer = {
        id: serverId,
        name: formData.name,
        ipAddress: formData.ipAddress,
        group: formData.group,
        sla: formData.sla,
        owner: formData.owner,
        // ... autres champs ...
      };
      
      // Ajouter à l'état
      setServers([...servers, newServer]);
      
      // ✅ CAPTURER L'ACTION
      captureUserActions.serverCreated(
        serverId,
        formData.name,
        currentUser.username, // Récupérer l'utilisateur courant
        {
          group: formData.group,
          sla: formData.sla,
          owner: formData.owner,
          ipAddress: formData.ipAddress,
        }
      );
      
      showSuccess('Serveur créé avec succès');
    } catch (error) {
      showError('Erreur lors de la création du serveur');
    }
  };

  // Fonction de modification de serveur
  const handleUpdateServer = async (serverId: string, changes: Partial<Server>) => {
    try {
      const oldServer = servers.find(s => s.id === serverId);
      
      // Mettre à jour le serveur
      const updated = { ...oldServer, ...changes };
      setServers(servers.map(s => s.id === serverId ? updated : s));
      
      // ✅ CAPTURER L'ACTION avec avant/après
      captureUserActions.serverModified(
        serverId,
        oldServer.name,
        currentUser.username,
        changes,
        {
          sla: oldServer.sla,
          owner: oldServer.owner,
          group: oldServer.group,
          // ... autres champs modifiés ...
        }
      );
      
      showSuccess('Serveur mis à jour');
    } catch (error) {
      showError('Erreur lors de la mise à jour');
    }
  };

  // Fonction de suppression de serveur
  const handleDeleteServer = async (serverId: string) => {
    try {
      const server = servers.find(s => s.id === serverId);
      
      // Supprimer le serveur
      setServers(servers.filter(s => s.id !== serverId));
      
      // ✅ CAPTURER L'ACTION
      captureUserActions.serverDeleted(
        serverId,
        server.name,
        currentUser.username,
        'User initiated deletion'
      );
      
      showSuccess('Serveur supprimé');
    } catch (error) {
      showError('Erreur lors de la suppression');
    }
  };
}
*/

// ============================================================
// EXEMPLE 2: Intégration dans src/app/api/system/metrics/route.ts
// ============================================================

/*
import { captureSystemEvents } from '@/services/eventCapture';

export async function GET(request: NextRequest) {
  try {
    // Récupérer l'ancien état des serveurs
    const previousServers = store.getServers();
    
    // Fetcher les nouvelles métriques
    const servers = await fetchServerMetrics();
    
    // Mettre à jour l'état
    store.setServers(servers);
    
    // Détecter les changements et capturer les événements
    servers.forEach(server => {
      const previous = previousServers.find(s => s.id === server.id);
      
      if (!previous) return;
      
      // 1. Vérifier changement de statut
      if (server.status !== previous.status) {
        captureSystemEvents.serverStatusChanged(
          server.id,
          server.name,
          previous.status,
          server.status,
          'Detected during metrics polling'
        );
      }
      
      // 2. Vérifier anomalies CPU
      if (server.metrics.cpuUsage > 80) {
        captureSystemEvents.metricsAnomalyDetected(
          server.id,
          server.name,
          'CPU',
          server.metrics.cpuUsage,
          80
        );
      }
      
      // 3. Vérifier anomalies RAM
      if (server.metrics.memoryUsage > 85) {
        captureSystemEvents.metricsAnomalyDetected(
          server.id,
          server.name,
          'RAM',
          server.metrics.memoryUsage,
          85
        );
      }
      
      // 4. Vérifier anomalies Disk
      if (server.metrics.diskUsage > 90) {
        captureSystemEvents.metricsAnomalyDetected(
          server.id,
          server.name,
          'Disk',
          server.metrics.diskUsage,
          90
        );
      }
      
      // 5. Log health check
      captureSystemEvents.healthCheckPerformed(
        server.id,
        server.name,
        server.healthScore,
        previous.healthScore
      );
      
      // 6. Vérifier changement d'uptime (possible reboot)
      if (server.metrics.uptime < previous.metrics.uptime) {
        captureSystemEvents.uptimeEvent(
          server.id,
          server.name,
          'reboot',
          server.metrics.uptime
        );
      }
    });
    
    return NextResponse.json({ ok: true, servers });
  } catch (error) {
    // Log error as critical system event
    logger.logSystem(
      'Metrics Collection Failed',
      'SystemMetricsAPI',
      'error',
      { error: error.message }
    );
    throw error;
  }
}
*/

// ============================================================
// EXEMPLE 3: Intégration dans src/app/api/auth/login/route.ts
// ============================================================

/*
import { captureSecurityEvents } from '@/services/securityEventCapture';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || request.ip || '0.0.0.0';
    
    // Chercher l'utilisateur
    const user = await findUserInAD(username);
    
    if (!user || !verifyPassword(password, user.passwordHash)) {
      // ❌ Authentification échouée
      captureSecurityEvents.loginFailed(
        username,
        ip,
        'Invalid username or password'
      );
      
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // ✅ Authentification réussie
    captureSecurityEvents.loginSuccess(username, ip);
    
    // Créer la session/token
    const token = generateToken(user);
    
    return NextResponse.json({
      ok: true,
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    logger.logSystem(
      'Login Endpoint Error',
      'AuthAPI',
      'error',
      { error: error.message }
    );
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
*/

// ============================================================
// EXEMPLE 4: Intégration dans src/app/api/auth/logout/route.ts
// ============================================================

/*
import { captureSecurityEvents } from '@/services/securityEventCapture';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const user = verifyToken(token);
    const ip = request.headers.get('x-forwarded-for') || request.ip || '0.0.0.0';
    
    // Récupérer la durée de session (optionnel)
    const sessionStart = user.iat;
    const sessionDuration = Date.now() - (sessionStart * 1000);
    
    // ✅ Capturer la déconnexion
    captureSecurityEvents.logoutEvent(
      user.username,
      ip,
      sessionDuration
    );
    
    // Invalider le token/session
    invalidateToken(token);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}
*/

// ============================================================
// EXEMPLE 5: Intégration dans src/app/tickets/page.tsx
// ============================================================

/*
import { captureUserActions } from '@/services/userActionCapture';

export default function TicketsPage() {
  const handleCreateTicket = async (formData: TicketFormData) => {
    try {
      const ticketId = 'tkt-' + Date.now();
      const newTicket = {
        id: ticketId,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        status: 'open',
        createdAt: new Date(),
      };
      
      setTickets([...tickets, newTicket]);
      
      // ✅ CAPTURER LA CRÉATION
      captureUserActions.ticketCreated(
        ticketId,
        formData.title,
        currentUser.username,
        {
          priority: formData.priority,
          category: formData.category,
          description: formData.description,
        }
      );
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handleUpdateTicket = async (ticketId: string, changes: Partial<Ticket>) => {
    try {
      const oldTicket = tickets.find(t => t.id === ticketId);
      const updated = { ...oldTicket, ...changes };
      setTickets(tickets.map(t => t.id === ticketId ? updated : t));
      
      // ✅ CAPTURER LA MODIFICATION
      captureUserActions.ticketModified(
        ticketId,
        oldTicket.title,
        currentUser.username,
        changes,
        {
          status: oldTicket.status,
          assignedTo: oldTicket.assignedTo,
          // ... autres champs ...
        }
      );
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const handleCloseTicket = async (ticketId: string, resolution: string) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      const updated = { ...ticket, status: 'closed', resolvedAt: new Date() };
      setTickets(tickets.map(t => t.id === ticketId ? updated : t));
      
      // ✅ CAPTURER LA FERMETURE
      captureUserActions.ticketClosed(
        ticketId,
        ticket.title,
        currentUser.username,
        resolution
      );
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };
}
*/

// ============================================================
// EXEMPLE 6: Middleware pour capturer l'accès admin
// ============================================================

/*
import { captureSecurityEvents } from '@/services/securityEventCapture';

export async function adminAccessMiddleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const user = verifyToken(token);
  const ip = request.headers.get('x-forwarded-for') || request.ip || '0.0.0.0';
  
  // Vérifier si l'utilisateur a le rôle admin
  if (user.role !== 'admin') {
    // ⚠️ Log accès non autorisé
    captureSecurityEvents.unauthorizedAccess(
      user.username,
      request.nextUrl.pathname,
      ip
    );
    
    return new NextResponse('Unauthorized', { status: 403 });
  }
  
  // ✅ Log accès admin réussi
  captureSecurityEvents.loginSuccess(user.username, ip);
  
  // Continuer...
  return NextResponse.next();
}
*/

// ============================================================
// RÉSUMÉ DES POINTS D'INTÉGRATION
// ============================================================

/*
📍 Points d'intégration recommandés:

1. SERVEURS (src/app/servers/page.tsx)
   - onCreate → serverCreated()
   - onUpdate → serverModified()
   - onDelete → serverDeleted()
   - onGroupChange → serverModified()
   - onSLAChange → serverModified()

2. UTILISATEURS (src/app/users/page.tsx)
   - onCreate → userCreated()
   - onUpdate → userModified()
   - onDelete → userDeleted()
   - onRoleChange → permissionChanged()

3. TICKETS (src/app/tickets/page.tsx)
   - onCreate → ticketCreated()
   - onUpdate → ticketModified()
   - onClose → ticketClosed()
   - onAssign → ticketModified()

4. AUTHENTIFICATION (src/app/api/auth/)
   - onLogin → loginSuccess() ou loginFailed()
   - onLogout → logoutEvent()
   - onPasswordReset → passwordReset()

5. MÉTRIQUES (src/app/api/system/metrics/)
   - onStatusChange → serverStatusChanged()
   - onAnomalyDetected → metricsAnomalyDetected()
   - onHealthCheck → healthCheckPerformed()
   - onUptimeChange → uptimeEvent()

6. SÉCURITÉ (src/app/api/)
   - onUnauthorizedAccess → unauthorizedAccess()
   - onSuspiciousActivity → securityAnomalyDetected()
   - onDataExport → dataExportedSecurity()
   - onPermissionChange → permissionChanged()
*/
