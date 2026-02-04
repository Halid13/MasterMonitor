'use client';

import { useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Subnet } from '@/types';
import { Plus, Trash2, Edit2 } from 'lucide-react';

type SubnetForm = {
  name: string;
  mainNetworkCidr: string;
  calculationMode: 'hosts' | 'subnets';
  hostCount: number;
  subnetCount: number;
  subnetIndexMode: 'auto' | 'index';
  subnetIndex: number;
  department: string;
  service: string;
};

type SubnetCalculation = {
  valid: boolean;
  error?: string;
  subnetCidr?: string;
  networkAddress?: string;
  netmask?: string;
  rangeStart?: string;
  rangeEnd?: string;
  usableHosts?: number;
  prefix?: number;
  networkInt?: number;
  broadcastInt?: number;
  totalSubnets?: number;
  subnetIndex?: number;
  actualSubnets?: number;
};

const ipToInt = (ip: string) => {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return (
    (numbers[0] << 24) +
    (numbers[1] << 16) +
    (numbers[2] << 8) +
    numbers[3]
  ) >>> 0;
};

const intToIp = (value: number) => {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
};

const maskFromPrefix = (prefix: number) => {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
};

const parseCidr = (cidr: string) => {
  const [ip, prefixStr] = cidr.split('/');
  if (!ip || prefixStr === undefined) return null;
  const prefix = Number(prefixStr);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const ipInt = ipToInt(ip);
  if (ipInt === null) return null;
  return { ipInt, prefix };
};

const getUsableHosts = (prefix: number) => {
  const total = 2 ** (32 - prefix);
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  return Math.max(total - 2, 0);
};

const calculatePrefixForHosts = (hostCount: number) => {
  const requiredHosts = Math.floor(hostCount);
  if (Number.isNaN(requiredHosts) || requiredHosts <= 0) return null;
  for (let prefix = 32; prefix >= 0; prefix -= 1) {
    if (getUsableHosts(prefix) >= requiredHosts) return prefix;
  }
  return null;
};

const calculatePrefixForSubnets = (mainPrefix: number, subnetCount: number) => {
  const desiredSubnets = Math.floor(subnetCount);
  if (Number.isNaN(desiredSubnets) || desiredSubnets <= 0) return null;
  const extraBits = Math.ceil(Math.log2(desiredSubnets));
  const prefix = mainPrefix + extraBits;
  if (prefix > 32) return null;
  return { prefix, actualSubnets: 2 ** extraBits };
};

const hasOverlap = (start: number, end: number, existingSubnets: Subnet[]) => {
  return existingSubnets.some((subnet) => {
    const subnetStart = ipToInt(subnet.rangeStart);
    const subnetEnd = ipToInt(subnet.rangeEnd);
    if (subnetStart === null || subnetEnd === null) return false;
    return !(end < subnetStart || start > subnetEnd);
  });
};

const computeSubnetPlan = (
  mainCidr: string,
  mode: 'hosts' | 'subnets',
  hostCount: number,
  subnetCount: number,
  subnetIndexMode: 'auto' | 'index',
  subnetIndex: number,
  existingSubnets: Subnet[],
): SubnetCalculation => {
  if (!mainCidr) {
    return { valid: false };
  }

  const main = parseCidr(mainCidr);
  if (!main) {
    return { valid: false, error: 'Réseau principal invalide (ex: 192.168.0.0/16)' };
  }

  let prefix: number | null = null;
  let actualSubnets: number | undefined;

  if (mode === 'hosts') {
    prefix = calculatePrefixForHosts(hostCount);
    if (prefix === null) {
      return { valid: false, error: 'Nombre d’hôtes invalide ou trop élevé' };
    }
  } else {
    const subnetResult = calculatePrefixForSubnets(main.prefix, subnetCount);
    if (!subnetResult) {
      return { valid: false, error: 'Nombre de sous-réseaux invalide pour ce réseau principal' };
    }
    prefix = subnetResult.prefix;
    actualSubnets = subnetResult.actualSubnets;
  }

  if (prefix < main.prefix) {
    return { valid: false, error: 'Le réseau principal est trop petit pour ce plan de sous-réseaux' };
  }

  const mainMask = maskFromPrefix(main.prefix);
  const mainNetwork = main.ipInt & mainMask;
  const mainBroadcast = (mainNetwork | (~mainMask >>> 0)) >>> 0;
  const subnetSize = 2 ** (32 - prefix);
  const totalSubnets = 2 ** (prefix - main.prefix);

  let chosenIndex: number | null = null;

  if (subnetIndexMode === 'index') {
    const requestedIndex = Math.floor(subnetIndex) - 1;
    if (Number.isNaN(requestedIndex) || requestedIndex < 0 || requestedIndex >= totalSubnets) {
      return { valid: false, error: `Index invalide. Choisissez entre 1 et ${totalSubnets}` };
    }
    chosenIndex = requestedIndex;
  } else {
    for (let index = 0; index < totalSubnets; index += 1) {
      const candidateStart = (mainNetwork + index * subnetSize) >>> 0;
      const candidateEnd = (candidateStart + subnetSize - 1) >>> 0;
      if (candidateEnd > mainBroadcast) continue;
      if (!hasOverlap(candidateStart, candidateEnd, existingSubnets)) {
        chosenIndex = index;
        break;
      }
    }
  }

  if (chosenIndex === null) {
    return { valid: false, error: 'Aucun sous-réseau disponible pour ce plan' };
  }

  const networkInt = (mainNetwork + chosenIndex * subnetSize) >>> 0;
  const broadcastInt = (networkInt + subnetSize - 1) >>> 0;

  if (networkInt < mainNetwork || broadcastInt > mainBroadcast) {
    return { valid: false, error: 'Sous-réseau hors du réseau principal' };
  }

  const subnetMask = maskFromPrefix(prefix);
  const usableHosts = getUsableHosts(prefix);
  const rangeStartInt = prefix >= 31 ? networkInt : (networkInt + 1) >>> 0;
  const rangeEndInt = prefix >= 31 ? broadcastInt : (broadcastInt - 1) >>> 0;

  return {
    valid: true,
    subnetCidr: `${intToIp(networkInt)}/${prefix}`,
    networkAddress: intToIp(networkInt),
    netmask: intToIp(subnetMask),
    rangeStart: intToIp(rangeStartInt),
    rangeEnd: intToIp(rangeEndInt),
    usableHosts,
    prefix,
    networkInt,
    broadcastInt,
    totalSubnets,
    subnetIndex: chosenIndex + 1,
    actualSubnets,
  };
};

const isIpInRange = (ip: string, start: string, end: string) => {
  const ipInt = ipToInt(ip);
  const startInt = ipToInt(start);
  const endInt = ipToInt(end);
  if (ipInt === null || startInt === null || endInt === null) return false;
  return ipInt >= startInt && ipInt <= endInt;
};

export default function IPAddressesPage() {
  const { subnets, addSubnet, updateSubnet, deleteSubnet, ipAddresses } = useDashboardStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SubnetForm>({
    name: '',
    mainNetworkCidr: '',
    calculationMode: 'hosts',
    hostCount: 50,
    subnetCount: 4,
    subnetIndexMode: 'auto',
    subnetIndex: 1,
    department: '',
    service: '',
  });

  const calculation = useMemo(
    () =>
      computeSubnetPlan(
        formData.mainNetworkCidr,
        formData.calculationMode,
        formData.hostCount,
        formData.subnetCount,
        formData.subnetIndexMode,
        formData.subnetIndex,
        subnets.filter((subnet) => subnet.id !== editingId),
      ),
    [
      formData.mainNetworkCidr,
      formData.calculationMode,
      formData.hostCount,
      formData.subnetCount,
      formData.subnetIndexMode,
      formData.subnetIndex,
      subnets,
      editingId,
    ],
  );

  const usedCountBySubnet = (subnet: Subnet) => {
    if (!subnet.rangeStart || !subnet.rangeEnd) return 0;
    return ipAddresses.filter((ip) => isIpInRange(ip.address, subnet.rangeStart, subnet.rangeEnd)).length;
  };

  const totalUsable = useMemo(() => subnets.reduce((sum, subnet) => sum + subnet.usableHosts, 0), [subnets]);
  const totalUsed = useMemo(
    () => subnets.reduce((sum, subnet) => sum + usedCountBySubnet(subnet), 0),
    [subnets, ipAddresses],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!calculation.valid) {
      setFormError(calculation.error || 'Informations insuffisantes pour calculer le sous-réseau');
      return;
    }

    const overlaps = subnets.some((subnet) => {
      if (editingId && subnet.id === editingId) return false;
      const subnetStart = ipToInt(subnet.rangeStart);
      const subnetEnd = ipToInt(subnet.rangeEnd);
      if (subnetStart === null || subnetEnd === null) return false;
      if (calculation.networkInt === undefined || calculation.broadcastInt === undefined) return false;
      return !(calculation.broadcastInt < subnetStart || calculation.networkInt > subnetEnd);
    });

    if (overlaps) {
      setFormError('Ce sous-réseau chevauche un sous-réseau existant');
      return;
    }

    const payload = {
      name: formData.name.trim() || `Sous-réseau ${calculation.subnetCidr}`,
      mainNetworkCidr: formData.mainNetworkCidr.trim(),
      subnetCidr: calculation.subnetCidr as string,
      networkAddress: calculation.networkAddress as string,
      prefix: calculation.prefix as number,
      netmask: calculation.netmask as string,
      rangeStart: calculation.rangeStart as string,
      rangeEnd: calculation.rangeEnd as string,
      usableHosts: calculation.usableHosts as number,
      department: formData.department.trim(),
      service: formData.service.trim(),
      updatedAt: new Date(),
    };

    if (editingId) {
      updateSubnet(editingId, payload);
      setEditingId(null);
    } else {
      const newSubnet: Subnet = {
        id: Date.now().toString(),
        createdAt: new Date(),
        ...payload,
      };
      addSubnet(newSubnet);
    }

    setFormError(null);
    setFormData({
      name: '',
      mainNetworkCidr: '',
      calculationMode: 'hosts',
      hostCount: 50,
      subnetCount: 4,
      subnetIndexMode: 'auto',
      subnetIndex: 1,
      department: '',
      service: '',
    });
    setShowModal(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des sous-réseaux</h1>
            <p className="text-gray-600 mt-2">Créez des sous-réseaux à partir d’un réseau principal et suivez l’utilisation des IP</p>
          </div>
          <button
            onClick={() => {
              setFormError(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Ajouter un sous-réseau
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">
                {editingId ? 'Modifier le sous-réseau' : 'Ajouter un sous-réseau'}
              </h2>
              <p className="text-sm text-gray-500 mb-4">Le calcul est automatique et respecte les règles de sous-réseautage</p>

              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du sous-réseau</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Bureau Paris"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Réseau principal (CIDR)</label>
                    <input
                      type="text"
                      value={formData.mainNetworkCidr}
                      onChange={(e) => setFormData({ ...formData, mainNetworkCidr: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="192.168.0.0/16"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de calcul</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          checked={formData.calculationMode === 'hosts'}
                          onChange={() => setFormData({ ...formData, calculationMode: 'hosts' })}
                        />
                        Par nombre d’hôtes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          checked={formData.calculationMode === 'subnets'}
                          onChange={() => setFormData({ ...formData, calculationMode: 'subnets' })}
                        />
                        Par nombre de sous-réseaux
                      </label>
                    </div>
                  </div>

                  {formData.calculationMode === 'hosts' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d’hôtes requis</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.hostCount}
                        onChange={(e) => setFormData({ ...formData, hostCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="50"
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de sous-réseaux souhaité</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.subnetCount}
                        onChange={(e) => setFormData({ ...formData, subnetCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="4"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Choix du sous-réseau</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          checked={formData.subnetIndexMode === 'auto'}
                          onChange={() => setFormData({ ...formData, subnetIndexMode: 'auto' })}
                        />
                        Auto (prochain disponible)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          checked={formData.subnetIndexMode === 'index'}
                          onChange={() => setFormData({ ...formData, subnetIndexMode: 'index' })}
                        />
                        Index précis
                      </label>
                    </div>
                  </div>

                  {formData.subnetIndexMode === 'index' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Index du sous-réseau</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.subnetIndex}
                        onChange={(e) => setFormData({ ...formData, subnetIndex: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1"
                        required
                      />
                      {calculation.totalSubnets && (
                        <p className="mt-1 text-xs text-gray-500">Disponible: 1 → {calculation.totalSubnets}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Informatique"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                    <input
                      type="text"
                      value={formData.service}
                      onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Support"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Calcul automatique</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">Masque :</span> {calculation.netmask || '—'}
                    </div>
                    <div>
                      <span className="font-medium">CIDR :</span> {calculation.subnetCidr || '—'}
                    </div>
                    <div>
                      <span className="font-medium">Préfixe :</span> {calculation.prefix ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium">Index :</span> {calculation.subnetIndex ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium">Plage utilisable :</span> {calculation.rangeStart && calculation.rangeEnd ? `${calculation.rangeStart} → ${calculation.rangeEnd}` : '—'}
                    </div>
                    <div>
                      <span className="font-medium">IP utilisables :</span> {calculation.usableHosts ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium">Sous-réseaux possibles :</span> {calculation.totalSubnets ?? '—'}
                    </div>
                    {formData.calculationMode === 'subnets' && (
                      <div>
                        <span className="font-medium">Sous-réseaux fournis :</span> {calculation.actualSubnets ?? '—'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
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
                      setFormError(null);
                      setFormData({
                        name: '',
                        mainNetworkCidr: '',
                        calculationMode: 'hosts',
                        hostCount: 50,
                        subnetCount: 4,
                        subnetIndexMode: 'auto',
                        subnetIndex: 1,
                        department: '',
                        service: '',
                      });
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

        {/* Subnets Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nom</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Réseau principal</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sous-réseau</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Masque</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Plage utilisable</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">IP utilisables</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Utilisation</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Attribution</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subnets.map((subnet) => {
                  const used = usedCountBySubnet(subnet);
                  const available = Math.max(subnet.usableHosts - used, 0);
                  const usagePercent = subnet.usableHosts > 0 ? Math.min((used / subnet.usableHosts) * 100, 100) : 0;

                  return (
                    <tr key={subnet.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{subnet.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{subnet.mainNetworkCidr}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{subnet.subnetCidr}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{subnet.netmask}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{subnet.rangeStart} → {subnet.rangeEnd}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{subnet.usableHosts}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{used} utilisées</span>
                            <span>{available} dispo</span>
                          </div>
                          <div className="h-2 w-28 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="font-medium text-gray-800">{subnet.department}</div>
                        <div className="text-xs text-gray-500">{subnet.service}</div>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => {
                            setEditingId(subnet.id);
                            setFormError(null);
                            const main = parseCidr(subnet.mainNetworkCidr);
                            const mainNetwork = main ? (main.ipInt & maskFromPrefix(main.prefix)) : null;
                            const subnetSize = 2 ** (32 - subnet.prefix);
                            const networkInt = ipToInt(subnet.networkAddress);
                            const derivedIndex =
                              mainNetwork !== null && networkInt !== null
                                ? Math.floor((networkInt - mainNetwork) / subnetSize) + 1
                                : 1;
                            const totalSubnets = main ? 2 ** (subnet.prefix - main.prefix) : 1;
                            setFormData({
                              name: subnet.name,
                              mainNetworkCidr: subnet.mainNetworkCidr,
                              calculationMode: 'hosts',
                              hostCount: subnet.usableHosts,
                              subnetCount: totalSubnets,
                              subnetIndexMode: 'index',
                              subnetIndex: derivedIndex,
                              department: subnet.department,
                              service: subnet.service,
                            });
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteSubnet(subnet.id)}
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
          {subnets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun sous-réseau trouvé</p>
            </div>
          )}
        </div>

        {/* Subnet Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Sous-réseaux</p>
            <p className="text-3xl font-bold text-gray-900">{subnets.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">IP utilisables</p>
            <p className="text-3xl font-bold text-blue-600">{totalUsable}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">IP utilisées</p>
            <p className="text-3xl font-bold text-green-600">{totalUsed}</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
