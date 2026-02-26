'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Bell, LogOut, Settings, LayoutDashboard, Users, Server, Ticket, FileText, Shield, Monitor } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard';

interface LayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [adminName, setAdminName] = useState<string>('Administrateur');
  const [showNotifications, setShowNotifications] = useState(false);
  const [isStoreBootstrapped, setIsStoreBootstrapped] = useState(false);
  const browserTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const {
    alerts,
    logs,
    users,
    equipment,
    servers,
    tickets,
    ipAddresses,
    subnets,
    setUsers,
    setEquipment,
    setServers,
    setTickets,
    setAlerts,
    setIPAddresses,
    setSubnets,
    setLogs,
  } = useDashboardStore();

  const syncStateRef = useRef({ users, equipment, servers, tickets, alerts, ipAddresses, subnets });

  useEffect(() => {
    syncStateRef.current = { users, equipment, servers, tickets, alerts, ipAddresses, subnets };
  }, [users, equipment, servers, tickets, alerts, ipAddresses, subnets]);

  const notificationItems = useMemo(() => {
    const recentAlerts = alerts
      .filter((a) => !a.isResolved)
      .slice(0, 3)
      .map((a) => ({
        id: `alert-${a.id}`,
        title: a.title || 'Alerte',
        message: a.message,
        type: a.type || 'info',
        time: 'Maintenant',
      }));

    const criticalLogs = logs
      .filter((l) => l.level === 'critical')
      .slice(0, 3)
      .map((l) => ({
        id: `log-${l.id}`,
        title: 'Log critique',
        message: `${l.action} • ${l.objectImpacted}`,
        type: 'critical',
        time: new Date(l.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      }));

    return [...recentAlerts, ...criticalLogs].slice(0, 5);
  }, [alerts, logs]);

  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('mm_user='));
    if (cookie) {
      const value = decodeURIComponent(cookie.split('=')[1] || '');
      if (value) {
        const trimmed = value.includes('@') ? value.split('@')[0] : value;
        setAdminName(trimmed);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapStoreFromDb = async () => {
      try {
        const res = await fetch('/api/monitoring?view=store', { cache: 'no-store' });
        const data = await res.json();
        if (!isMounted || !data?.ok || !data?.store) return;

        setUsers(Array.isArray(data.store.users) ? data.store.users : []);
        setEquipment(Array.isArray(data.store.equipment) ? data.store.equipment : []);
        setServers(Array.isArray(data.store.servers) ? data.store.servers : []);
        setTickets(Array.isArray(data.store.tickets) ? data.store.tickets : []);
        setAlerts(Array.isArray(data.store.alerts) ? data.store.alerts : []);
        setIPAddresses(Array.isArray(data.store.ipAddresses) ? data.store.ipAddresses : []);
        setSubnets(Array.isArray(data.store.subnets) ? data.store.subnets : []);
        setLogs(Array.isArray(data.store.logs) ? data.store.logs : []);
      } catch {
        // keep app usable even if bootstrap fails
      } finally {
        if (isMounted) {
          setIsStoreBootstrapped(true);
        }
      }
    };

    void bootstrapStoreFromDb();

    return () => {
      isMounted = false;
    };
  }, [setAlerts, setEquipment, setIPAddresses, setLogs, setServers, setSubnets, setTickets, setUsers]);

  useEffect(() => {
    if (!isStoreBootstrapped) return;

    let destroyed = false;

    const getConnectedUser = () => {
      const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('mm_user='));
      if (!cookie) return undefined;
      const raw = decodeURIComponent(cookie.split('=')[1] || '').trim();
      return raw || undefined;
    };

    const sendSnapshot = async (mode: 'realtime' | 'dynamic' | 'static') => {
      if (destroyed) return;
      try {
        const current = syncStateRef.current;
        const hasData =
          current.users.length > 0 ||
          current.equipment.length > 0 ||
          current.servers.length > 0 ||
          current.tickets.length > 0 ||
          current.alerts.length > 0 ||
          current.ipAddresses.length > 0 ||
          current.subnets.length > 0;

        if (!hasData) return;

        const connectedUser = getConnectedUser();
        const payload: any = {
          connectedUser,
          realtime: {
            sentAt: new Date().toISOString(),
            serversCount: current.servers.length,
            alertsCount: current.alerts.length,
            openTicketsCount: current.tickets.filter((ticket) => ticket.status !== 'closed').length,
          },
          dynamic: {
            sentAt: new Date().toISOString(),
            equipmentCount: current.equipment.length,
            ipCount: current.ipAddresses.length,
            subnetCount: current.subnets.length,
          },
          staticData: {
            sentAt: new Date().toISOString(),
            usersCount: current.users.length,
          },
        };

        if (mode === 'realtime') {
          payload.servers = current.servers;
          payload.tickets = current.tickets;
          payload.alerts = current.alerts;
          payload.ipAddresses = current.ipAddresses;
        }

        if (mode === 'dynamic') {
          payload.equipment = current.equipment;
          payload.ipAddresses = current.ipAddresses;
          payload.subnets = current.subnets;
        }

        if (mode === 'static') {
          payload.users = current.users;
          payload.equipment = current.equipment;
          payload.servers = current.servers;
          payload.tickets = current.tickets;
          payload.subnets = current.subnets;
        }

        await fetch('/api/monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // silent: dashboard should continue even when sync fails
      }
    };

    void sendSnapshot('realtime');
    const realtimeTimer = window.setInterval(() => {
      void sendSnapshot('realtime');
    }, 5000);

    const dynamicTimer = window.setInterval(() => {
      void sendSnapshot('dynamic');
    }, 30000);

    const staticTimer = window.setInterval(() => {
      void sendSnapshot('static');
    }, 5 * 60 * 1000);

    return () => {
      destroyed = true;
      window.clearInterval(realtimeTimer);
      window.clearInterval(dynamicTimer);
      window.clearInterval(staticTimer);
    };
  }, [isStoreBootstrapped]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
      router.push('/login');
    }
  };

  const menuItems = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, color: 'from-blue-500 to-cyan-500' },
    { href: '/equipment', label: 'Équipements', icon: Monitor, color: 'from-purple-500 to-pink-500' },
    { href: '/users', label: 'Utilisateurs', icon: Users, color: 'from-emerald-500 to-teal-500' },
    { href: '/servers', label: 'Serveurs', icon: Server, color: 'from-yellow-500 to-orange-500' },
    { href: '/ip-addresses', label: 'Sous Réseau', icon: Monitor, color: 'from-cyan-500 to-blue-500' },
    { href: '/tickets', label: 'Tickets', icon: Ticket, color: 'from-pink-500 to-rose-500' },
    { href: '/logs', label: 'Logs', icon: FileText, color: 'from-indigo-500 to-blue-500' },
  ];

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.14),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)]">
        <div className="absolute -top-20 right-0 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-indigo-300/10 blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} border-r border-slate-200/70 bg-white/85 backdrop-blur-xl flex flex-col transition-all duration-300 ease-out shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]`}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200/70">
          <div className="flex items-center gap-3 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-500 flex items-center justify-center text-white shadow-md ring-1 ring-cyan-200/60">
              <Shield size={20} />
            </div>
            {sidebarOpen && (
              <div>
                <span className="text-base font-bold text-slate-900">MasterMonitor</span>
                <p className="text-xs text-slate-500">Operations Hub</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const isHovered = hoveredItem === item.href;
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-md`
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {/* Background animation for active items */}
                {isActive && (
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
                
                <Icon size={18} className={`flex-shrink-0 transition-all duration-200 ${isHovered ? 'scale-110' : ''}`} />
                {sidebarOpen && (
                  <span className={`text-sm font-semibold transition-all duration-200 ${isHovered ? 'translate-x-0.5' : ''}`}>
                    {item.label}
                  </span>
                )}
                
                {/* Active indicator dot */}
                {isActive && sidebarOpen && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-white/40 animate-pulse"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="px-4 py-4 border-t border-slate-200/70"></div>

        {/* Sidebar Footer */}
        <div className="px-4 py-4 space-y-2">
          <button
            onClick={() => router.push('/settings')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors group"
          >
            <Settings size={18} className="flex-shrink-0 group-hover:rotate-90 transition-transform duration-500" />
            {sidebarOpen && <span className="text-sm font-medium">Paramètres</span>}
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors group"
          >
            <LogOut size={18} className="flex-shrink-0 group-hover:-translate-x-1 transition-transform duration-300" />
            {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="relative z-40 border-b border-slate-200/70 bg-white/80 px-6 py-4 backdrop-blur-xl shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Espace de supervision et d'administration de la plateforme.</p>

            <div className="flex items-center gap-3">
              <div className="relative isolate">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Bell size={18} />
                {notificationItems.length > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 z-[60]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Fermer
                    </button>
                  </div>

                  {notificationItems.length === 0 ? (
                    <div className="text-xs text-slate-500 py-6 text-center">Aucune notification</div>
                  ) : (
                    <div className="space-y-2">
                      {notificationItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                            <span className="text-[10px] text-slate-400">{item.time}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-200/60">
                    <button
                      onClick={() => router.push('/logs')}
                      className="w-full text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Voir tous les logs
                    </button>
                  </div>
                </div>
              )}
            </div>

              {/* Profile */}
              <div className="relative group">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm cursor-pointer">
                  <div className="text-right leading-tight">
                    <p className="text-sm font-bold text-slate-900">{adminName}</p>
                    <p className="text-[11px] text-slate-500">Administrateur</p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                    {adminName.charAt(0).toUpperCase() || 'A'}
                  </div>
                </div>

                <div className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-64 translate-y-1 rounded-2xl border border-slate-200/80 bg-white/95 p-3 opacity-0 shadow-xl backdrop-blur transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="text-xs font-semibold text-slate-900">Infos rapides admin</p>
                  <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Compte</span>
                      <span className="font-medium text-slate-800">{adminName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rôle</span>
                      <span className="font-medium text-slate-800">Administrateur</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Session</span>
                      <span className="font-medium text-emerald-600">Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Fuseau</span>
                      <span className="font-medium text-slate-800">{browserTimezone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .logout-pop {
          animation: logoutPop 220ms ease-out;
        }
        @keyframes logoutPop {
          0% { transform: scale(0.96) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="logout-pop w-full max-w-sm rounded-2xl bg-white/90 border border-white/30 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <LogOut size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Confirmer la déconnexion</p>
                <p className="text-xs text-slate-500">Voulez-vous vraiment vous déconnecter ?</p>
              </div>
            </div>
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors disabled:opacity-70"
              >
                {isLoggingOut ? 'Déconnexion…' : 'Déconnecter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
