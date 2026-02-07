'use client';

import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Plus, Users, UserCheck } from 'lucide-react';

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

type ADGroup = {
  id: string;
  name: string;
  dn: string;
  description: string;
  membersCount: number;
};

export default function UsersPage() {
  const [adUsers, setAdUsers] = useState<ADUser[]>([]);
  const [adLoading, setAdLoading] = useState(true);
  const [adError, setAdError] = useState('');
  const [adGroups, setAdGroups] = useState<ADGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');

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
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/ad/groups');
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setGroupsError(data?.error || 'Erreur de synchronisation AD.');
          setGroupsLoading(false);
          return;
        }
        setAdGroups(data.groups || []);
        setGroupsLoading(false);
      } catch {
        setGroupsError('Erreur réseau.');
        setGroupsLoading(false);
      }
    };
    fetchUsers();
    fetchGroups();
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'users'
                ? 'bg-teal-500 text-white shadow'
                : 'bg-white/60 text-slate-600 hover:bg-white'
            }`}
          >
            Utilisateurs AD
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'groups'
                ? 'bg-teal-500 text-white shadow'
                : 'bg-white/60 text-slate-600 hover:bg-white'
            }`}
          >
            Groupes AD
          </button>
        </div>

        {activeTab === 'users' && (
          <>
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

            {/* Users List */}
            <div className="space-y-2">
              {!adLoading && adUsers.length === 0 && (
                <div className="text-center py-16 px-4">
                  <p className="text-xl text-slate-500 font-medium">Aucun utilisateur trouvé</p>
                  <p className="text-slate-400 mt-2">Vérifiez la connexion LDAP.</p>
                </div>
              )}
              {adUsers.map((user) => (
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
                    <div className="text-center min-w-[160px]">
                      <p className="text-slate-400 mb-0.5">Groupes</p>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {user.groups.length === 0 && (
                          <span className="text-xs text-slate-400">Aucun</span>
                        )}
                        {user.groups.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                            <Users size={12} /> {name}
                          </span>
                        ))}
                      </div>
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
          </>
        )}

        {activeTab === 'groups' && (
          <>
            {groupsLoading && (
              <div className="rounded-xl bg-white/70 border border-slate-200 p-4 text-sm text-slate-600">
                Chargement des groupes AD…
              </div>
            )}

            {groupsError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {groupsError}
              </div>
            )}

            <div className="space-y-2">
              {!groupsLoading && adGroups.length === 0 && (
                <div className="text-center py-16 px-4">
                  <p className="text-xl text-slate-500 font-medium">Aucun groupe trouvé</p>
                  <p className="text-slate-400 mt-2">Vérifiez la connexion LDAP.</p>
                </div>
              )}
              {adGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-lg bg-white/60 backdrop-blur-sm border border-slate-200/40 hover:bg-white/80 transition-colors duration-200"
                >
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-lg">
                    {group.name?.[0] || 'G'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-sm text-slate-900">{group.name}</h3>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-md whitespace-nowrap bg-slate-100 text-slate-700">
                        {group.membersCount} membre{group.membersCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{group.description || group.dn || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 text-slate-700 text-xs font-medium">
                      <Users size={14} /> Groupe AD
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}


      </div>
    </MainLayout>
  );
}
