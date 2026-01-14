'use client';

import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { IPAddress } from '@/types';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function IPAddressesPage() {
  const { ipAddresses, addIPAddress, updateIPAddress, deleteIPAddress } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IPAddress>>({
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      updateIPAddress(editingId, formData);
      setEditingId(null);
    } else {
      const newIP: IPAddress = {
        id: Date.now().toString(),
        address: formData.address || '',
        subnet: formData.subnet || '',
        gateway: formData.gateway || '',
        dnsServers: formData.dnsServers || [],
        isActive: formData.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addIPAddress(newIP);
    }

    setFormData({ isActive: true });
    setShowModal(false);
  };

  const getDNSServersDisplay = (servers: string[] | undefined) => {
    return servers?.join(', ') || '-';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des adresses IP</h1>
            <p className="text-gray-600 mt-2">Gérez votre infrastructure réseau et adresses IP</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Ajouter une adresse IP
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editingId ? 'Modifier l\'adresse IP' : 'Ajouter une adresse IP'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse IP</label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="192.168.1.1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sous-réseau</label>
                    <input
                      type="text"
                      value={formData.subnet || ''}
                      onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="255.255.255.0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passerelle</label>
                    <input
                      type="text"
                      value={formData.gateway || ''}
                      onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="192.168.1.254"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigné à</label>
                    <input
                      type="text"
                      value={formData.assignedTo || ''}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nom de l'équipement"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serveurs DNS (séparés par des virgules)</label>
                    <input
                      type="text"
                      value={formData.dnsServers?.join(', ') || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        dnsServers: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="8.8.8.8, 8.8.4.4"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive ?? true}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Adresse active</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingId(null);
                      setFormData({ isActive: true });
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* IP Addresses Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Adresse IP</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sous-réseau</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Passerelle</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Assigné à</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Serveurs DNS</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Statut</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ipAddresses.map((ip) => (
                  <tr key={ip.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">{ip.address}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{ip.subnet}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{ip.gateway}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{ip.assignedTo || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getDNSServersDisplay(ip.dnsServers)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${ip.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {ip.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(ip.id);
                          setFormData(ip);
                          setShowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteIPAddress(ip.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ipAddresses.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucune adresse IP trouvée</p>
            </div>
          )}
        </div>

        {/* IP Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Total des adresses</p>
            <p className="text-3xl font-bold text-gray-900">{ipAddresses.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Adresses actives</p>
            <p className="text-3xl font-bold text-green-600">{ipAddresses.filter(ip => ip.isActive).length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Adresses assignées</p>
            <p className="text-3xl font-bold text-blue-600">{ipAddresses.filter(ip => ip.assignedTo).length}</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
