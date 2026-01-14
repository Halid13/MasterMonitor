'use client';

import { ReactNode, useState } from 'react';
import { Menu, LogOut, Settings } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { href: '/', label: 'Tableau de bord', icon: '📊' },
    { href: '/equipment', label: 'Équipements', icon: '💻' },
    { href: '/users', label: 'Utilisateurs', icon: '👥' },
    { href: '/ip-addresses', label: 'Adresses IP', icon: '🌐' },
    { href: '/servers', label: 'Serveurs', icon: '⚙️' },
    { href: '/tickets', label: 'Tickets Helpdesk', icon: '🎫' },
  ];

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-800 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          {sidebarOpen && <h1 className="font-bold text-xl">MasterMonitor</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-slate-700 rounded"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-3 rounded hover:bg-slate-700 transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 space-y-2">
          <button className="flex items-center gap-3 w-full p-3 rounded hover:bg-slate-700 transition-colors">
            <Settings size={20} />
            {sidebarOpen && <span className="text-sm">Paramètres</span>}
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded hover:bg-red-600 transition-colors">
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm">Déconnexion</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">MasterMonitor Dashboard</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
