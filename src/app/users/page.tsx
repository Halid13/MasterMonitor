'use client';

import { useEffect, useState, useMemo } from 'react';
import MainLayout from '@/components/MainLayout';
import { Plus, UserCheck, Filter, Search, X, Laptop } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard';

type ADUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  groups: string[];
  role: 'admin' | 'manager' | 'technician' | 'user';
  isActive: boolean;
};

export default function UsersPage() {
  const { equipment } = useDashboardStore();
  const [adUsers, setAdUsers] = useState<ADUser[]>([]);
  const [adLoading, setAdLoading] = useState(true);
  const [adError, setAdError] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/ad/users');
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setAdError(data?.error || 'Erreur de synchronisation AD.');
          setAdLoading(false);
          return;
        }
        setAdUsers(data.users || []);
        setAdLoading(false);
      } catch {
        setAdError('Erreur réseau.');
        setAdLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-orange-100 text-orange-800';
      case 'technician':
        return 'bg-sky-100 text-sky-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      manager: 'Manager',
      technician: 'Technicien',
      user: 'Utilisateur',
    };
    return labels[role] || role;
  };

  // Extract unique values for filters
  const uniqueDepartments = useMemo(() => {
    return [...new Set(adUsers.map(u => u.department).filter(Boolean))];
  }, [adUsers]);

  const uniqueGroups = useMemo(() => {
    const allGroups = adUsers.flatMap(u => u.groups);
    return [...new Set(allGroups)].sort();
  }, [adUsers]);

  // Filtered users based on all filters and search
  const filteredUsers = useMemo(() => {
    return adUsers.filter(user => {
      // Role filter
      if (filterRole && user.role !== filterRole) return false;
      
      // Department filter
      if (filterDepartment && user.department !== filterDepartment) return false;
      
      // Group filter
      if (filterGroup && !user.groups.includes(filterGroup)) return false;
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          user.firstName,
          user.lastName,
          user.username,
          user.email,
          user.department,
          ...user.groups
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) return false;
      }
      
      return true;
    });
  }, [adUsers, filterRole, filterDepartment, filterGroup, searchQuery]);

  // Clear all filters
  const clearFilters = () => {
    setFilterRole('');
    setFilterDepartment('');
    setFilterGroup('');
    setSearchQuery('');
  };

  const hasActiveFilters = filterRole || filterDepartment || filterGroup || searchQuery;

  // Get equipment assigned to each user
  const getUserEquipment = useMemo(() => {
    const equipmentByUser: Record<string, typeof equipment> = {};
    adUsers.forEach(user => {
      equipmentByUser[user.id] = equipment.filter(eq => eq.assignedToUser === user.id);
    });
    return equipmentByUser;
  }, [equipment, adUsers]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-teal-600">Gestion des utilisateurs</h1>
            <p className="text-slate-600 mt-2">Synchronisés depuis l’Active Directory</p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-600 rounded-xl cursor-not-allowed"
            title="Les utilisateurs sont gérés par l’Active Directory"
          >
            <Plus size={20} />
            Gestion AD
          </button>
        </div>

        {adLoading && (
          <div className="rounded-xl bg-white/70 border border-slate-200 p-4 text-sm text-slate-600">
            Chargement des utilisateurs AD…
          </div>
        )}

        {adError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {adError}
          </div>
        )}

        {/* Filters Section */}
        <div className="rounded-2xl bg-gradient-to-br from-white via-teal-50/30 to-cyan-50/40 text-slate-900 border border-teal-100/60 shadow-[0_0_0_1px_rgba(20,184,166,0.12),0_20px_60px_-35px_rgba(20,184,166,0.25)] p-6 space-y-5 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center ring-1 ring-teal-500/20">
                <Filter size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Filtres et recherche</h2>
                <p className="text-xs text-slate-500">Filtrer par rôle, département, groupe ou rechercher</p>
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-700 text-sm font-semibold hover:bg-slate-500/20 ring-1 ring-slate-400/30"
              >
                <X size={16} /> Réinitialiser
              </button>
            )}
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-teal-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Rôle</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Tous les rôles</option>
                <option value="admin">Administrateur</option>
                <option value="manager">Manager</option>
                <option value="technician">Technicien</option>
                <option value="user">Utilisateur</option>
              </select>
            </div>

            <div className="rounded-xl border border-teal-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Département</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Tous les départements</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-teal-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Groupe AD</label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Tous les groupes</option>
                {uniqueGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-teal-100/70 bg-white/80 p-3">
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Résultats</label>
              <div className="flex items-center h-[34px] px-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-sm font-bold text-teal-600">{filteredUsers.length}</span>
                <span className="text-xs text-slate-500 ml-1">/ {adUsers.length}</span>
              </div>
            </div>
          </div>

          <div className="relative rounded-xl border border-teal-100/70 bg-white/80 p-3">
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Recherche (nom, prénom, email, département, groupe)</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Chercher un utilisateur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-2">
          {!adLoading && filteredUsers.length === 0 && adUsers.length > 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-xl text-slate-500 font-medium">Aucun utilisateur ne correspond aux filtres</p>
              <p className="text-slate-400 mt-2">Essayez de modifier vos critères de recherche.</p>
            </div>
          )}
          {!adLoading && adUsers.length === 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-xl text-slate-500 font-medium">Aucun utilisateur trouvé</p>
              <p className="text-slate-400 mt-2">Vérifiez la connexion LDAP.</p>
            </div>
          )}
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-4 px-5 py-4 rounded-lg bg-white/60 backdrop-blur-sm border border-slate-200/40 hover:bg-white/80 transition-colors duration-200 group"
            >
              {/* User Avatar/Icon */}
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-lg">
                {(user.firstName?.[0] || 'U')}{(user.lastName?.[0] || '')}
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-sm text-slate-900">{user.firstName} {user.lastName}</h3>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-md whitespace-nowrap ${getRoleColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-md whitespace-nowrap ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
                  <p><span className="text-slate-400">Nom:</span> {user.lastName || '—'}</p>
                  <p><span className="text-slate-400">Prénom:</span> {user.firstName || '—'}</p>
                  <p className="sm:col-span-2"><span className="text-slate-400">Mail:</span> {user.email || '—'}</p>
                </div>
              </div>

              {/* Details */}
              <div className="hidden md:flex items-center gap-6 flex-shrink-0 text-xs">
                <div className="text-center">
                  <p className="text-slate-400 mb-0.5">Département</p>
                  <p className="text-slate-700 font-medium">{user.department || '—'}</p>
                </div>
                <div className="text-center min-w-[140px]">
                  <p className="text-slate-400 mb-0.5">Équipements</p>
                  {getUserEquipment[user.id]?.length > 0 ? (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {getUserEquipment[user.id].map((eq) => (
                        <span key={eq.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium" title={`${eq.name} - ${eq.serialNumber}`}>
                          <Laptop size={12} /> {eq.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Aucun</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  <UserCheck size={14} /> Synchronisé AD
                </span>
              </div>
            </div>
          ))}
        </div>


      </div>
    </MainLayout>
  );
}
