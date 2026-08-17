'use client';

import { useMemo, useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Equipment } from '@/types';
import { Plus, Trash2, Edit2, X, Monitor, Server, Printer, Smartphone, Wifi, Package, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

const getCurrentUsername = () => getCookieValue('mm_user') || 'system';

const postLog = (payload: {
  category: 'action' | 'system' | 'user' | 'security';
  level: 'info' | 'warning' | 'error' | 'critical';
  module: string;
  action: string;
  objectImpacted: string;
  username?: string;
  details?: Record<string, any>;
}) => {
  fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Ignore client logging errors
  });
};

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

export default function EquipmentPage() {
  const { equipment, addEquipment, updateEquipment, deleteEquipment, cleanupOrphanedEquipment } = useDashboardStore();
  const [adUsers, setAdUsers] = useState<ADUser[]>([]);
  const [adUsersLoading, setAdUsersLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-service' | 'stock'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({
    type: 'pc',
    status: 'stock',
  });

  const persistEquipmentNow = async (items: Equipment[]) => {
    try {
      await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment: items,
          dynamic: {
            sentAt: new Date().toISOString(),
            equipmentCount: equipment.length,
          },
        }),
      });
    } catch {
      // fallback: periodic sync will retry later
    }
  };

  const getUserByAnyKey = (value?: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return undefined;

    return adUsers.find((user) => {
      const keys = [user.id, user.username, user.email]
        .filter(Boolean)
        .map((key) => String(key).trim().toLowerCase());
      return keys.includes(normalized);
    });
  };

  // Fetch AD users and cleanup orphaned equipment
  useEffect(() => {
    const fetchADUsers = async () => {
      try {
        const res = await fetch('/api/ad/users');
        const data = await res.json();
        if (data?.ok && Array.isArray(data.users)) {
          setAdUsers(data.users);
          // Cleanup equipment assigned to users that no longer exist in AD
          const validUserKeys = data.users.flatMap((u: ADUser) => [u.id, u.username, u.email]).filter(Boolean);
          cleanupOrphanedEquipment(validUserKeys as string[]);
        }
      } catch (error) {
        console.error('Failed to fetch AD users:', error);
      } finally {
        setAdUsersLoading(false);
      }
    };
    fetchADUsers();
  }, [cleanupOrphanedEquipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload: Partial<Equipment> = { ...formData, updatedAt: new Date() };

    if (payload.status === 'stock') {
      // En stock : on retire l'assignation et la date de mise en service
      payload.assignedToUser = undefined;
      payload.departmentService = undefined;
      payload.dateInService = undefined;
    } else if (payload.status === 'in-service') {
      const selectedUser = getUserByAnyKey(payload.assignedToUser);

      if (!selectedUser) {
        setFormError('Veuillez sélectionner un utilisateur valide pour cet équipement en service.');
        return;
      }

      payload.assignedToUser = selectedUser?.id || payload.assignedToUser;
      payload.departmentService = payload.departmentService || selectedUser?.department;
      payload.dateInService = payload.dateInService || new Date();
    }

    if (editingId) {
      const previous = equipment.find((item) => item.id === editingId);
      const updatedEquipment: Equipment = {
        ...(previous as Equipment),
        ...payload,
        id: editingId,
        updatedAt: new Date(),
      };
      updateEquipment(editingId, payload);
      await persistEquipmentNow([updatedEquipment]);
      setEditingId(null);
    } else {
      const newEquipment: Equipment = {
        id: Date.now().toString(),
        name: formData.name || '',
        type: formData.type as any,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || '',
        hardwareId: formData.hardwareId || '',
        status: payload.status as any,
        assignedToUser: payload.status === 'in-service' ? payload.assignedToUser : undefined,
        departmentService: payload.status === 'in-service' ? (payload.departmentService || getUserByAnyKey(payload.assignedToUser)?.department) : undefined,
        dateInService: payload.status === 'in-service' ? (payload.dateInService || new Date()) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addEquipment(newEquipment);
      await persistEquipmentNow([newEquipment]);
    }

    setFormData({ type: 'pc', status: 'stock' });
    setFormError(null);
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-service':
        return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' };
      case 'stock':
        return { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' };
      default:
        return { bg: 'bg-slate-500/20', border: 'border-slate-500/50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-800' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pc':
      case 'laptop': return Monitor;  // rétrocompat
      case 'server': return Server;
      case 'printer': return Printer;
      case 'phone': return Smartphone;
      case 'network': return Wifi;
      default: return Package;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pc: 'PC',
      laptop: 'PC',   // rétrocompat
      server: 'Serveur',
      printer: 'Imprimante',
      phone: 'Téléphone IP',
      network: 'Équipement réseau',
      other: 'Autre',
    };
    return labels[type] || type;
  };

  // Filtrage
  const filteredEquipment = useMemo(() => {
    // Normalise 'laptop' (ancienne valeur) vers 'pc'
    const normalize = (type: string) => type === 'laptop' ? 'pc' : type;
    return equipment.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const haystack = [item.name, item.serialNumber, item.hardwareId, item.ipAddress, item.departmentService]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterType !== 'all' && normalize(item.type) !== filterType) return false;
      return true;
    });
  }, [equipment, searchQuery, filterType]);

  const equipmentInService = filteredEquipment.filter(item => item.status === 'in-service');
  const equipmentInStock = filteredEquipment.filter(item => item.status === 'stock');

  // Fonction pour exporter les équipements en service en XLSX (1 champ = 1 colonne)
  const exportToXLSX = () => {
    if (equipmentInService.length === 0) {
      alert('Aucun équipement en service à exporter');
      return;
    }

    const headers = [
      'Marque',
      "Type d'équipement",
      'Numéro de série',
      'Identifiant matériel (IMEI)',
      'Statut',
      'Utilisateur assigné',
      'Service/Département',
      'Date de mise en service',
    ];

    const rows = equipmentInService.map(item => [
      item.name || 'VIDE',
      getTypeLabel(item.type),
      item.serialNumber || 'VIDE',
      item.hardwareId || 'VIDE',
      'En service',
      item.assignedToUser || 'VIDE',
      item.departmentService || 'VIDE',
      item.dateInService ? new Date(item.dateInService).toLocaleDateString('fr-FR') : 'VIDE',
    ]);

    const data = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Appliquer le style rouge aux cellules contenant "VIDE"
    const redFill = { fill: { fgColor: { rgb: 'FFFF0000' } } };
    const redFont = { font: { color: { rgb: 'FFFF0000' }, bold: true } };

    for (let i = 1; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
        if (data[i][j] === 'VIDE') {
          worksheet[cellRef].fill = redFill.fill;
          worksheet[cellRef].font = redFont.font;
        }
      }
    }

    // Ajuster la largeur des colonnes
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Équipements');
    XLSX.writeFile(workbook, `equipements_en_service_${new Date().toISOString().split('T')[0]}.xlsx`);

    postLog({
      category: 'action',
      level: 'info',
      module: 'Equipment',
      action: 'export',
      objectImpacted: 'equipments-in-service',
      username: getCurrentUsername(),
      details: { format: 'xlsx', count: equipmentInService.length },
    });
  };

  // Fonction pour exporter tous les équipements en XLSX (1 champ = 1 colonne) avec marquage des champs vides
  const exportAllToXLSX = () => {
    if (equipment.length === 0) {
      alert('Aucun équipement à exporter');
      return;
    }

    const headers = [
      'Marque',
      "Type d'équipement",
      'Numéro de série',
      'Identifiant matériel (IMEI)',
      'Adresse IP',
      'Statut',
      'Utilisateur assigné',
      'Service/Département',
      'Date de mise en service',
    ];

    const rows = equipment.map(item => [
      item.name || 'VIDE',
      getTypeLabel(item.type) || 'VIDE',
      item.serialNumber || 'VIDE',
      item.hardwareId || 'VIDE',
      item.ipAddress || 'VIDE',
      item.status === 'in-service' ? 'En service' : 'Stock',
      item.assignedToUser || 'VIDE',
      item.departmentService || 'VIDE',
      item.dateInService ? new Date(item.dateInService).toLocaleDateString('fr-FR') : 'VIDE',
    ]);

    const data = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Appliquer le style rouge aux cellules contenant "VIDE"
    const redFill = { fill: { fgColor: { rgb: 'FFFF0000' } } };
    const redFont = { font: { color: { rgb: 'FFFF0000' }, bold: true } };

    for (let i = 1; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
        if (data[i][j] === 'VIDE') {
          worksheet[cellRef].fill = redFill.fill;
          worksheet[cellRef].font = redFont.font;
        }
      }
    }

    // Ajuster la largeur des colonnes
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tous les équipements');
    XLSX.writeFile(workbook, `equipements_tous_${new Date().toISOString().split('T')[0]}.xlsx`);

    postLog({
      category: 'action',
      level: 'info',
      module: 'Equipment',
      action: 'export',
      objectImpacted: 'equipments-all',
      username: getCurrentUsername(),
      details: { format: 'xlsx', count: equipment.length },
    });
  };

  // Fonction pour exporter le stock en XLSX (1 champ = 1 colonne)
  const exportStockToXLSX = () => {
    if (equipmentInStock.length === 0) {
      alert('Aucun équipement en stock à exporter');
      return;
    }

    const headers = [
      'Marque',
      "Type d'équipement",
      'Numéro de série',
      'Identifiant matériel (IMEI)',
      'Statut',
    ];

    const rows = equipmentInStock.map(item => [
      item.name || 'VIDE',
      getTypeLabel(item.type),
      item.serialNumber || 'VIDE',
      item.hardwareId || 'VIDE',
      'Stock',
    ]);

    const data = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Appliquer le style rouge aux cellules contenant "VIDE"
    const redFill = { fill: { fgColor: { rgb: 'FFFF0000' } } };
    const redFont = { font: { color: { rgb: 'FFFF0000' }, bold: true } };

    for (let i = 1; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
        if (data[i][j] === 'VIDE') {
          worksheet[cellRef].fill = redFill.fill;
          worksheet[cellRef].font = redFont.font;
        }
      }
    }

    // Ajuster la largeur des colonnes
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');
    XLSX.writeFile(workbook, `equipements_stock_${new Date().toISOString().split('T')[0]}.xlsx`);

    postLog({
      category: 'action',
      level: 'info',
      module: 'Equipment',
      action: 'export',
      objectImpacted: 'equipments-stock',
      username: getCurrentUsername(),
      details: { format: 'xlsx', count: equipmentInStock.length },
    });
  };

  const EquipmentCard = ({ item }: { item: Equipment }) => {
    const TypeIcon = getTypeIcon(item.type);
    const statusColor = getStatusColor(item.status);
    const assignedUser = useMemo(() => getUserByAnyKey(item.assignedToUser), [adUsers, item.assignedToUser]);
    
    return (
      <div
        key={item.id}
        className="flex items-center gap-4 px-5 py-4 rounded-lg bg-white/60 backdrop-blur-sm border border-slate-200/40 hover:bg-white/80 transition-colors duration-200 group"
      >
        {/* Icon */}
        <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${statusColor.bg} ${statusColor.text}`}>
          <TypeIcon size={18} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-sm text-slate-900 truncate">{item.name || 'Équipement'}</h3>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-md whitespace-nowrap ${statusColor.badge}`}>
              {item.status === 'in-service' ? 'En service' : 'Stock'}
            </span>
          </div>
          <p className="text-xs text-slate-500">{getTypeLabel(item.type)}</p>
        </div>

        {/* Details row */}
        <div className="hidden md:flex items-center gap-6 flex-shrink-0 text-xs text-slate-600">
          {item.serialNumber && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">N° Série</p>
              <p className="font-mono text-slate-700">{item.serialNumber.substring(0, 10)}</p>
            </div>
          )}
          {item.hardwareId && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">IMEI / Asset</p>
              <p className="font-mono text-slate-700">{item.hardwareId.substring(0, 10)}</p>
            </div>
          )}
          {item.ipAddress && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">Adresse IP</p>
              <p className="font-mono text-blue-700">{item.ipAddress}</p>
            </div>
          )}
          {item.assignedToUser && item.status === 'in-service' && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">Utilisateur</p>
              <p className="text-slate-700">{assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : item.assignedToUser}</p>
            </div>
          )}
          {item.departmentService && item.status === 'in-service' && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">Service</p>
              <p className="text-slate-700">{item.departmentService}</p>
            </div>
          )}
          {item.dateInService && item.status === 'in-service' && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">En service</p>
              <p className="text-slate-700">{new Date(item.dateInService).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.status === 'stock' && (
            <button
              onClick={() => {
                setEditingId(item.id);
                setFormError(null);
                setFormData({
                  ...item,
                  status: 'in-service',
                  assignedToUser: getUserByAnyKey(item.assignedToUser)?.id || item.assignedToUser,
                });
                setShowModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-semibold"
              title="Assigner à un utilisateur"
            >
              Assigner
            </button>
          )}
          <button
            onClick={() => {
              setEditingId(item.id);
              setFormError(null);
              setFormData({
                ...item,
                assignedToUser: getUserByAnyKey(item.assignedToUser)?.id || item.assignedToUser,
              });
              setShowModal(true);
            }}
            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => {
              setDeleteTarget(item);
            }}
            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Gestion des Équipements</h1>
            <p className="text-slate-600 mt-2 text-sm">Gérez votre matériel informatique en service et en stock</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ type: 'pc', status: 'stock' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold group"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            Ajouter un équipement
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'in-service', 'stock'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  filterStatus === s
                    ? s === 'all' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow'
                      : s === 'in-service' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow'
                    : 'bg-white/60 border border-slate-200 text-slate-700 hover:bg-white/80'
                }`}
              >
                {s === 'all' ? 'Tous' : s === 'in-service' ? 'En service' : 'En stock'}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">Tous les types</option>
            <option value="pc">PC</option>
            <option value="server">Serveur</option>
            <option value="printer">Imprimante</option>
            <option value="phone">Téléphone IP</option>
            <option value="network">Équipement réseau</option>
            <option value="other">Autre</option>
          </select>

          {/* Export buttons */}
          <button
            onClick={filterStatus === 'stock' ? exportStockToXLSX : filterStatus === 'in-service' ? exportToXLSX : exportAllToXLSX}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors font-medium"
          >
            <Download size={15} /> Exporter XLSX
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {editingId ? "Modifier l'équipement" : 'Ajouter un équipement'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData({ type: 'pc', status: 'stock' });
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Marque *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      required
                      placeholder="ex: Apple, Dell, HP"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Type d'équipement *</label>
                    <select
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      required
                    >
                      <option value="pc">PC</option>
                      <option value="server">Serveur</option>
                      <option value="printer">Imprimante</option>
                      <option value="phone">Téléphone IP</option>
                      <option value="network">Équipement réseau</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Modèle</label>
                    <input
                      type="text"
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      placeholder="ex: MacBook Pro 14, Lenovo ThinkPad T14"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Numéro de série *</label>
                    <input
                      type="text"
                      value={formData.serialNumber || ''}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      required
                      placeholder="SN123456789"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Identifiant matériel (IMEI / asset tag)</label>
                    <input
                      type="text"
                      value={formData.hardwareId || ''}
                      onChange={(e) => setFormData({ ...formData, hardwareId: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      placeholder="IMEI ou identifiant unique"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Adresse IP associée</label>
                    <input
                      type="text"
                      value={formData.ipAddress || ''}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      placeholder="ex: 192.168.1.100"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Statut *</label>
                    <select
                      value={formData.status || ''}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      required
                    >
                      <option value="stock">Stock (Non en service)</option>
                      <option value="in-service">En service</option>
                    </select>
                  </div>

                  {formData.status === 'in-service' && (
                    <>
                      {(formData.type === 'printer' || formData.type === 'network' || formData.type === 'phone' || formData.type === 'pc' || formData.type === 'server') && (
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-900 mb-2">Service/Département</label>
                          <input
                            type="text"
                            value={formData.departmentService || ''}
                            onChange={(e) => setFormData({ ...formData, departmentService: e.target.value })}
                            className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                            placeholder="ex: IT, RH, Ventes"
                          />
                        </div>
                      )}

                      <div className="group">
                        <label className="block text-xs font-semibold text-slate-900 mb-2">Utilisateur assigné</label>
                        <select
                          value={formData.assignedToUser || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              setFormData({
                                ...formData,
                                assignedToUser: undefined,
                                departmentService: undefined,
                                dateInService: undefined,
                                status: 'stock',
                              });
                              return;
                            }
                            const u = adUsers.find((us) => us.id === val);
                            setFormData({
                              ...formData,
                              assignedToUser: val,
                              departmentService: u?.department || formData.departmentService,
                              dateInService: formData.dateInService || new Date(),
                              status: 'in-service',
                            });
                          }}
                          className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                          disabled={adUsersLoading}
                          size={3}
                        >
                          <option value="">{adUsersLoading ? 'Chargement...' : '— Sélectionner un utilisateur —'}</option>
                          {adUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.username})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="group">
                        <label className="block text-xs font-semibold text-slate-900 mb-2">Date de mise en service</label>
                        <input
                          type="date"
                          value={formData.dateInService ? new Date(formData.dateInService).toISOString().split('T')[0] : ''}
                          onChange={(e) => setFormData({ ...formData, dateInService: e.target.value ? new Date(e.target.value) : undefined })}
                          className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3 pt-6 border-t border-white/20">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    {editingId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData({ type: 'pc', status: 'stock' });
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-xl hover:bg-slate-300 transition-all duration-300 font-semibold"
                  >
                    ❌ Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Section Équipements en Service */}
        {equipmentInService.length > 0 && (filterStatus === 'all' || filterStatus === 'in-service') && (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white/60 to-emerald-50/40 backdrop-blur-sm border border-emerald-200/40 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-emerald-200/40">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-emerald-900">Équipements en Service</h2>
                <p className="text-xs text-emerald-600/70">Matériel actuellement déployé</p>
              </div>
              <span className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-bold">{equipmentInService.length}</span>
            </div>
            <div className="space-y-2">
              {equipmentInService.map((item) => (
                <EquipmentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Section Stock */}
        {equipmentInStock.length > 0 && (filterStatus === 'all' || filterStatus === 'stock') && (
          <div className="rounded-2xl bg-gradient-to-br from-blue-50/80 via-white/60 to-blue-50/40 backdrop-blur-sm border border-blue-200/40 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-blue-200/40">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-blue-900">Matériel Disponible</h2>
                <p className="text-xs text-blue-600/70">En attente de déploiement</p>
              </div>
              <span className="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 text-sm font-bold">{equipmentInStock.length}</span>
            </div>
            <div className="space-y-2">
              {equipmentInStock.map((item) => (
                <EquipmentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredEquipment.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <AlertCircle size={48} className="text-slate-400 mb-4" />
            <p className="text-xl text-slate-500 font-medium">Aucun équipement trouvé</p>
            <p className="text-slate-400 mt-2">
              {equipment.length === 0 ? 'Commencez par en ajouter un !' : 'Aucun résultat pour ces filtres.'}
            </p>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirmer la suppression</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Voulez-vous supprimer <span className="font-semibold">{deleteTarget.name}</span> ?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 mb-5">
              Cette action est définitive. Les informations associées à cet équipement seront perdues.
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  void fetch('/api/monitoring', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deletedEquipmentIds: [deleteTarget.id] }),
                  }).catch(() => {});
                  deleteEquipment(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
