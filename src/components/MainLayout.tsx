'use client';

import { ReactNode, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Bell, LogOut, Settings, Search, Home, Zap, Users, Globe, Cpu, Ticket } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const menuItems = [
    { href: '/', label: 'Tableau de bord', icon: Home, color: 'from-blue-500 to-cyan-500' },
    { href: '/equipment', label: 'Équipements', icon: Cpu, color: 'from-purple-500 to-pink-500' },
    { href: '/users', label: 'Utilisateurs', icon: Users, color: 'from-emerald-500 to-teal-500' },
    { href: '/ip-addresses', label: 'Adresses IP', icon: Globe, color: 'from-orange-500 to-red-500' },
    { href: '/servers', label: 'Serveurs', icon: Zap, color: 'from-yellow-500 to-orange-500' },
    { href: '/tickets', label: 'Tickets', icon: Ticket, color: 'from-pink-500 to-rose-500' },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 text-slate-900 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-white/40 backdrop-blur-xl border-r border-white/20 flex flex-col transition-all duration-500 ease-out shadow-xl`}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/20">
          {sidebarOpen && (
            <div className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg">
                M
              </div>
              <div>
                <span className="text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">MasterMonitor</span>
                <p className="text-xs text-slate-500">Dashboard Pro</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-slate-600 hover:bg-white/40 hover:text-slate-900 transition-all duration-300 hover:scale-110"
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
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-105`
                    : 'text-slate-700 hover:bg-white/30'
                }`}
              >
                {/* Background animation for active items */}
                {isActive && (
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
                
                <Icon size={20} className={`flex-shrink-0 transition-all duration-300 ${isHovered ? 'scale-125' : ''}`} />
                {sidebarOpen && (
                  <span className={`text-sm font-semibold transition-all duration-300 ${isHovered ? 'translate-x-1' : ''}`}>
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
        <div className="px-4 py-4 border-t border-white/20"></div>

        {/* Sidebar Footer */}
        <div className="px-4 py-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-white/40 transition-all duration-300 group hover:scale-105">
            <Settings size={18} className="flex-shrink-0 group-hover:rotate-90 transition-transform duration-500" />
            {sidebarOpen && <span className="text-sm font-medium">Paramètres</span>}
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-500/20 transition-all duration-300 group hover:scale-105">
            <LogOut size={18} className="flex-shrink-0 group-hover:-translate-x-1 transition-transform duration-300" />
            {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/30 backdrop-blur-xl border-b border-white/20 px-8 flex items-center justify-between gap-4 shadow-sm">
          {/* Search Bar */}
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              {/* Animated gradient background */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl opacity-0 group-hover:opacity-75 group-focus-within:opacity-75 transition-all duration-500 blur-lg group-hover:blur-xl"></div>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-30 group-focus-within:opacity-30 transition-opacity duration-300"></div>
              
              <div className="relative flex items-center bg-white/70 backdrop-blur-lg rounded-2xl border-2 border-white/40 hover:border-white/60 focus-within:border-transparent transition-all duration-300 group-hover:bg-white/90">
                <Search size={20} className="absolute left-4 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300 group-hover:scale-110" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="relative flex-1 pl-12 pr-4 py-3.5 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all duration-300"
                />
                <kbd className="hidden sm:inline-block px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100/50 rounded-lg mr-3">⌘K</kbd>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-3 text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-xl transition-all duration-300 group hover:scale-110">
              <Bell size={20} className="group-hover:animate-bounce" />
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 animate-pulse shadow-lg" />
            </button>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-4 border-l border-white/20 group cursor-pointer">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">Admin</p>
                <p className="text-xs text-slate-500">Administrateur</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300 shadow-lg">
                A
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
      `}</style>
    </div>
  );
};

export default MainLayout;
