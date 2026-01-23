'use client';

import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Equipment } from '@/types';
import { Plus, Trash2, Edit2, X, Laptop, Printer, Smartphone, Wifi, Package, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function EquipmentPage() {
  const { equipment, addEquipment, updateEquipment, deleteEquipment } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-service' | 'stock'>('all');
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
        status: formData.status as any,
        assignedToUser: formData.assignedToUser,
        departmentService: formData.departmentService,
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
  };

  const EquipmentCard = ({ item }: { item: Equipment }) => {
    const TypeIcon = getTypeIcon(item.type);
    const statusColor = getStatusColor(item.status);
    
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
              <p className="text-slate-400 mb-0.5">SN</p>
              <p className="font-mono text-slate-700">{item.serialNumber.substring(0, 8)}...</p>
            </div>
          )}
          {item.assignedToUser && item.status === 'in-service' && (
            <div className="text-center">
              <p className="text-slate-400 mb-0.5">Utilisateur</p>
              <p className="text-slate-700">{item.assignedToUser}</p>
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
          <button
            onClick={() => {
              setEditingId(item.id);
              setFormData(item);
              setShowModal(true);
            }}
            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => deleteEquipment(item.id)}
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
              setFormData({ type: 'laptop', status: 'stock' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 font-semibold group"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            Ajouter un équipement
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
              filterStatus === 'all'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg scale-105'
                : 'bg-white/50 backdrop-blur-lg border border-white/30 text-slate-900 hover:bg-white/70'
            }`}
          >
            🔍 Tous les équipements
          </button>
          {filterStatus === 'all' && (
            <button
              onClick={exportAllToXLSX}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-800 transition-colors"
            >
              <Download size={16} />
              Exporter XLSX (Tous)
            </button>
          )}
          <button
            onClick={() => setFilterStatus('in-service')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
              filterStatus === 'in-service'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                : 'bg-white/50 backdrop-blur-lg border border-white/30 text-slate-900 hover:bg-white/70'
            }`}
          >
            ✅ En service
          </button>
          <button
            onClick={() => setFilterStatus('stock')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
              filterStatus === 'stock'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                : 'bg-white/50 backdrop-blur-lg border border-white/30 text-slate-900 hover:bg-white/70'
            }`}
          >
            📦 En stock
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
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

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
                      <option value="laptop">Laptop</option>
                      <option value="printer">Imprimante</option>
                      <option value="phone">Téléphone IP</option>
                      <option value="network">Équipement réseau</option>
                      <option value="other">Autre</option>
                    </select>
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
                    <label className="block text-xs font-semibold text-slate-900 mb-2">Identifiant matériel (IMEI)</label>
                    <input
                      type="text"
                      value={formData.hardwareId || ''}
                      onChange={(e) => setFormData({ ...formData, hardwareId: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                      placeholder="IMEI ou identifiant unique"
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
                      {(formData.type === 'printer' || formData.type === 'network' || formData.type === 'phone' || formData.type === 'laptop') && (
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

                      {(formData.type === 'laptop' || formData.type === 'phone' || formData.type === 'other') && (
                        <div className="group">
                          <label className="block text-xs font-semibold text-slate-900 mb-2">Utilisateur assigné</label>
                          <input
                            type="text"
                            value={formData.assignedToUser || ''}
                            onChange={(e) => setFormData({ ...formData, assignedToUser: e.target.value })}
                            className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all group-hover:bg-white/70"
                            placeholder="Nom ou ID de l'utilisateur"
                          />
                        </div>
                      )}

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
                    {editingId ? '💾 Mettre à jour' : '✅ Ajouter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData({ type: 'laptop', status: 'stock' });
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
              <div className="p-2 rounded-lg bg-emerald-100/50">
                <span className="text-2xl">✅</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-emerald-900">Équipements en Service</h2>
                <p className="text-xs text-emerald-600/70">Matériel actuellement déployé</p>
              </div>
              <button
                onClick={exportToXLSX}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors font-semibold"
                title="Exporter en XLSX"
              >
                <Download size={16} />
                Exporter XLSX
              </button>
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
              <div className="p-2 rounded-lg bg-blue-100/50">
                <span className="text-2xl">📦</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-blue-900">Matériel Disponible</h2>
                <p className="text-xs text-blue-600/70">En attente de déploiement</p>
              </div>
              <button
                onClick={exportStockToXLSX}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors font-semibold"
                title="Exporter en XLSX"
              >
                <Download size={16} />
                Exporter XLSX
              </button>
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
