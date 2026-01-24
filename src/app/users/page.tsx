'use client';

import { useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import SelectDropdown from '@/components/SelectDropdown';
import { useDashboardStore } from '@/store/dashboard';
import { User } from '@/types';
import { Plus, Trash2, Edit2, Laptop, Phone, X } from 'lucide-react';

type HistoryEntry = {
  id: string;
  timestamp: Date;
  action: string;
};

export default function UsersPage() {
  const { users, equipment, addUser, updateUser, deleteUser, updateEquipment } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    role: 'user',
    isActive: true,
  });
  const [selectedLaptopId, setSelectedLaptopId] = useState<string>('');
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});

  const availableLaptops = useMemo(
    () => equipment.filter((e) => e.type === 'laptop' && (!e.assignedToUser || e.assignedToUser === editingId)),
    [equipment, editingId],
  );

  const availablePhones = useMemo(
    () => equipment.filter((e) => e.type === 'phone' && (!e.assignedToUser || e.assignedToUser === editingId)),
    [equipment, editingId],
  );

  const userAssignments = useMemo(
    () =>
      users.reduce<Record<string, { laptops: string[]; phones: string[] }>>((acc, user) => {
        acc[user.id] = { laptops: [], phones: [] };
        equipment.forEach((eq) => {
          if (eq.assignedToUser === user.id && eq.type === 'laptop') acc[user.id].laptops.push(eq.name);
          if (eq.assignedToUser === user.id && eq.type === 'phone') acc[user.id].phones.push(eq.name);
        });
        return acc;
      }, {}),
    [equipment, users],
  );

  const recordHistory = (userId: string, action: string) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      action,
    };
    setHistories((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] || []), entry],
    }));
  };

  const handleEquipmentAssignments = (userId: string, laptopId?: string, phoneId?: string) => {
    const owned = equipment.filter(
      (eq) => eq.assignedToUser === userId && (eq.type === 'laptop' || eq.type === 'phone'),
    );

    // Unassign equipment no longer selected
    owned.forEach((eq) => {
      const keep = (eq.type === 'laptop' && eq.id === laptopId) || (eq.type === 'phone' && eq.id === phoneId);
      if (!keep) {
        updateEquipment(eq.id, { assignedToUser: undefined, status: 'stock', updatedAt: new Date() });
        recordHistory(userId, `Désassignation de ${eq.name}`);
      }
    });

    if (laptopId) {
      updateEquipment(laptopId, { assignedToUser: userId, status: 'in-service', updatedAt: new Date() });
      recordHistory(userId, 'Attribution d’un laptop');
    }
    if (phoneId) {
      updateEquipment(phoneId, { assignedToUser: userId, status: 'in-service', updatedAt: new Date() });
      recordHistory(userId, 'Attribution d’un téléphone IP');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      updateUser(editingId, { ...formData, updatedAt: new Date() });
      handleEquipmentAssignments(editingId, selectedLaptopId || undefined, selectedPhoneId || undefined);
      setEditingId(null);
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        username: formData.username || '',
        email: formData.email || '',
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        role: formData.role as any,
        department: formData.department || '',
        isActive: formData.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addUser(newUser);
      handleEquipmentAssignments(newUser.id, selectedLaptopId || undefined, selectedPhoneId || undefined);
      recordHistory(newUser.id, 'Création du profil utilisateur');
    }

    setFormData({ role: 'user', isActive: true });
    setSelectedLaptopId('');
    setSelectedPhoneId('');
    setShowModal(false);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-orange-100 text-orange-800';
      case 'technician':
        return 'bg-blue-100 text-blue-800';
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">Gestion des utilisateurs</h1>
            <p className="text-slate-600 mt-2">Créer, attribuer des ressources et suivre les changements</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            Ajouter un utilisateur
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto hide-scrollbar border border-white/20 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {editingId ? '✏️ Modifier l\'utilisateur' : '➕ Ajouter un utilisateur'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {editingId ? 'Mettez à jour les informations et les ressources' : 'Créez un nouveau profil et attribuez ses ressources'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData({ role: 'user', isActive: true });
                    setSelectedLaptopId('');
                    setSelectedPhoneId('');
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Fermer le formulaire"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 text-sm">
                {/* Informations personnelles */}
                <div className="bg-white/70 border border-white/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-600">Informations personnelles</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2">Nom *</label>
                      <input
                        type="text"
                        value={formData.lastName || ''}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                        placeholder="Dupont"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2">Prénom *</label>
                      <input
                        type="text"
                        value={formData.firstName || ''}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                        placeholder="Jean"
                        required
                      />
                    </div>

                    <div className="group sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-900 mb-2">Email professionnel *</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                        placeholder="jean.dupont@company.com"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2">Nom d'utilisateur *</label>
                      <input
                        type="text"
                        value={formData.username || ''}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                        placeholder="jdupont"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2">Département *</label>
                      <input
                        type="text"
                        value={formData.department || ''}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                        placeholder="IT / RH / Finance..."
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Paramètres d'accès */}
                <div className="bg-white/70 border border-white/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-600">Paramètres d'accès</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2">Rôle *</label>
                      <SelectDropdown
                        value={formData.role || ''}
                        onChange={(val) => setFormData({ ...formData, role: val as any })}
                        options={[
                          { value: 'user', label: 'Utilisateur' },
                          { value: 'technician', label: 'Technicien' },
                          { value: 'manager', label: 'Manager' },
                          { value: 'admin', label: 'Administrateur' },
                        ]}
                        placeholder="Sélectionner un rôle"
                        className="px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 group-hover:bg-white/70"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/30 bg-white/50 hover:bg-white/70 transition-all cursor-pointer w-full">
                        <input
                          type="checkbox"
                          checked={formData.isActive ?? true}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-slate-700">Utilisateur actif</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Attribution de ressources */}
                <div className="bg-white/70 border border-white/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-600">Ressources</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <Laptop size={16} className="text-blue-500" /> Laptop
                      </label>
                      <SelectDropdown
                        value={selectedLaptopId}
                        onChange={(val) => setSelectedLaptopId(val)}
                        options={[
                          { value: '', label: 'Aucun' },
                          ...availableLaptops.map((eq) => ({ value: eq.id, label: `${eq.name} (${eq.serialNumber})` })),
                        ]}
                        placeholder="Sélectionner un laptop"
                        className="px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 group-hover:bg-white/70"
                      />
                    </div>

                    <div className="group">
                      <label className="block text-xs font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <Phone size={16} className="text-cyan-500" /> Téléphone IP
                      </label>
                      <SelectDropdown
                        value={selectedPhoneId}
                        onChange={(val) => setSelectedPhoneId(val)}
                        options={[
                          { value: '', label: 'Aucun' },
                          ...availablePhones.map((eq) => ({ value: eq.id, label: `${eq.name} (${eq.serialNumber})` })),
                        ]}
                        placeholder="Sélectionner un téléphone"
                        className="px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 group-hover:bg-white/70"
                      />
                    </div>
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                  >
                    {editingId ? 'Mettre à jour l\'utilisateur' : 'Créer l\'utilisateur'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData({ role: 'user', isActive: true });
                      setSelectedLaptopId('');
                      setSelectedPhoneId('');
                    }}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/70 to-slate-50/50 backdrop-blur-sm border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/70 border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Utilisateur</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Département</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Équipements</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Rôle</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Statut</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {users.map((user) => {
                  const laptopList = userAssignments[user.id]?.laptops || [];
                  const phoneList = userAssignments[user.id]?.phones || [];
                  return (
                    <tr key={user.id} className="hover:bg-white/60 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                        <p className="text-xs text-slate-500">{user.username}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.department}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 space-y-1">
                        {laptopList.length === 0 && phoneList.length === 0 && (
                          <span className="text-xs text-slate-400">Aucun équipement</span>
                        )}
                        {laptopList.map((name) => (
                          <span key={name} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                            <Laptop size={14} /> {name}
                          </span>
                        ))}
                        {phoneList.map((name) => (
                          <span key={name} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-medium">
                            <Phone size={14} /> {name}
                          </span>
                        ))}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => {
                            setEditingId(user.id);
                            setFormData(user);
                            const currentLaptop = equipment.find(
                              (eq) => eq.assignedToUser === user.id && eq.type === 'laptop',
                            );
                            const currentPhone = equipment.find(
                              (eq) => eq.assignedToUser === user.id && eq.type === 'phone',
                            );
                            setSelectedLaptopId(currentLaptop?.id || '');
                            setSelectedPhoneId(currentPhone?.id || '');
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            deleteUser(user.id);
                            handleEquipmentAssignments(user.id); // Unassign all
                            recordHistory(user.id, 'Suppression du profil utilisateur');
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-500">Aucun utilisateur trouvé</p>
            </div>
          )}
        </div>

        {/* Suivi utilisateur */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {users.map((user) => {
            const timeline = histories[user.id] || [];
            const laptopList = userAssignments[user.id]?.laptops || [];
            const phoneList = userAssignments[user.id]?.phones || [];
            return (
              <div
                key={user.id}
                className="rounded-2xl bg-gradient-to-br from-slate-50/80 via-white/70 to-slate-50/50 backdrop-blur-sm border border-slate-200/60 shadow-sm p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{user.firstName} {user.lastName}</h3>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">{user.department}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Équipements</p>
                  <div className="flex flex-wrap gap-2">
                    {laptopList.map((name) => (
                      <span key={name} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        <Laptop size={14} /> {name}
                      </span>
                    ))}
                    {phoneList.map((name) => (
                      <span key={name} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-medium">
                        <Phone size={14} /> {name}
                      </span>
                    ))}
                    {laptopList.length === 0 && phoneList.length === 0 && (
                      <span className="text-xs text-slate-400">Aucun équipement attribué</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Historique des changements</p>
                  {timeline.length === 0 ? (
                    <p className="text-xs text-slate-400">Aucun changement enregistré</p>
                  ) : (
                    <div className="space-y-2">
                      {timeline
                        .slice()
                        .reverse()
                        .slice(0, 4)
                        .map((entry) => (
                          <div key={entry.id} className="flex items-start gap-3">
                            <div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                            <div>
                              <p className="text-sm text-slate-800">{entry.action}</p>
                              <p className="text-xs text-slate-500">
                                {entry.timestamp.toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style jsx global>{`
        .hide-scrollbar {
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
    </MainLayout>
  );
}
