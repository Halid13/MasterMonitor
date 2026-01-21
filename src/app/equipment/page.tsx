'use client';

import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Equipment } from '@/types';
import { Plus, Trash2, Edit2, X, Laptop, Printer, Smartphone, Wifi, Package, AlertCircle } from 'lucide-react';

export default function EquipmentPage() {
  const { equipment, addEquipment, updateEquipment, deleteEquipment } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({
    type: 'laptop',
    status: 'stock',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      updateEquipment(editingId, formData);
      setEditingId(null);
    } else {
      const newEquipment: Equipment = {
        id: Date.now().toString(),
        name: formData.name || '',
        type: formData.type as any,
        serialNumber: formData.serialNumber || '',
        hardwareId: formData.hardwareId || '',
        ipAddress: formData.ipAddress || '',
        status: formData.status as any,
        assignedToUser: formData.assignedToUser,
        dateInService: formData.dateInService,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addEquipment(newEquipment);
    }

    setFormData({ type: 'laptop', status: 'stock' });
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
      case 'laptop':
        return Laptop;
      case 'printer':
        return Printer;
      case 'phone':
        return Smartphone;
      case 'network':
        return Wifi;
      default:
        return Package;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      laptop: 'Laptop',
      printer: 'Imprimante',
      phone: 'Téléphone IP',
      network: 'Équipement réseau',
      other: 'Autre',
    };
    return labels[type] || type;
  };

  // Séparer les équipements en deux catégories
  const equipmentInService = equipment.filter(item => item.status === 'in-service');
  const equipmentInStock = equipment.filter(item => item.status === 'stock');

  const EquipmentCard = ({ item }: { item: Equipment }) => {
    const TypeIcon = getTypeIcon(item.type);
    const statusColor = getStatusColor(item.status);
    
    return (
      <div
        key={item.id}
        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${statusColor.border} ${statusColor.bg}`}
      >
        {/* Animated background gradient */}
        <div className="absolute -inset-full bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rotate-45 group-hover:rotate-12 group-hover:scale-150"></div>
        
        <div className="relative p-6 h-full flex flex-col backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-white/20 backdrop-blur group-hover:scale-110 transition-transform duration-300 ${statusColor.text}`}>
                <TypeIcon size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 line-clamp-2">{item.name}</h3>
                <p className={`text-sm font-medium ${statusColor.text}`}>{getTypeLabel(item.type)}</p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-4">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusColor.badge}`}>
              {item.status === 'in-service' && '✅ En service'}
              {item.status === 'stock' && '📦 Stock'}
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-3 text-sm">
            {item.serialNumber && (
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">N° Série:</span>
                <span className="text-slate-900 font-semibold">{item.serialNumber}</span>
              </div>
            )}
            {item.hardwareId && (
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">IMEI:</span>
                <span className="text-slate-900 font-semibold">{item.hardwareId}</span>
              </div>
            )}
            {item.ipAddress && (
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Adresse IP:</span>
                <span className="text-slate-900 font-semibold font-mono text-xs">{item.ipAddress}</span>
              </div>
            )}
            {item.assignedToUser && item.status === 'in-service' && (
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Assigné à:</span>
                <span className="text-slate-900 font-semibold">{item.assignedToUser}</span>
              </div>
            )}
            {item.dateInService && item.status === 'in-service' && (
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Mis en service:</span>
                <span className="text-slate-900 font-semibold">{new Date(item.dateInService).toLocaleDateString('fr-FR')}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-white/20">
            <button
              onClick={() => {
                setEditingId(item.id);
                setFormData(item);
                setShowModal(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/80 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 font-medium group/btn"
            >
              <Edit2 size={16} className="group-hover/btn:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
            <button
              onClick={() => deleteEquipment(item.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-all duration-300 font-medium group/btn"
            >
              <Trash2 size={16} className="group-hover/btn:scale-110 transition-transform" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
          </div>
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Gestion des Équipements</h1>
            <p className="text-slate-600 mt-2 text-lg">Gérez votre matériel informatique en service et en stock</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ type: 'laptop', status: 'stock' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold group"
          >
            <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
            Ajouter un équipement
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {editingId ? '✏️ Modifier l\'équipement' : '➕ Ajouter un équipement'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setFormData({ type: 'laptop', status: 'stock' });
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Nom de l'équipement *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      required
                      placeholder="ex: MacBook Pro de John"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Type d'équipement *</label>
                    <select
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      required
                    >
                      <option value="laptop">Laptop</option>
                      <option value="printer">Imprimante</option>
                      <option value="phone">Téléphone IP</option>
                      <option value="network">Équipement réseau</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Numéro de série *</label>
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
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Identifiant matériel (IMEI)</label>
                    <input
                      type="text"
                      value={formData.hardwareId || ''}
                      onChange={(e) => setFormData({ ...formData, hardwareId: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      placeholder="IMEI ou identifiant unique"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Adresse IP</label>
                    <input
                      type="text"
                      value={formData.ipAddress || ''}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Statut *</label>
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
                      <div className="group">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Utilisateur assigné</label>
                        <input
                          type="text"
                          value={formData.assignedToUser || ''}
                          onChange={(e) => setFormData({ ...formData, assignedToUser: e.target.value })}
                          className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                          placeholder="Nom ou ID de l'utilisateur"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Date de mise en service</label>
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
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    {editingId ? '💾 Mettre à jour' : '✅ Ajouter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData({ type: 'laptop', status: 'stock' });
                    }}
                    className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all duration-300 font-semibold"
                  >
                    ❌ Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Section Équipements en Service */}
        {equipmentInService.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">✅ Équipements en Service</h2>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">{equipmentInService.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equipmentInService.map((item) => (
                <EquipmentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Section Stock */}
        {equipmentInStock.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">📦 Matériel Disponible (Stock)</h2>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">{equipmentInStock.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equipmentInStock.map((item) => (
                <EquipmentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {equipment.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <AlertCircle size={48} className="text-slate-400 mb-4" />
            <p className="text-xl text-slate-500 font-medium">Aucun équipement trouvé</p>
            <p className="text-slate-400 mt-2">Commencez par en ajouter un!</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
