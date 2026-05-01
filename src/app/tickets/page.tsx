'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import MainLayout from '@/components/MainLayout';
import { Ticket } from '@/types';
import { Edit2, RefreshCw, CheckCircle, ExternalLink, User, Search, Filter, Clock3, CircleDot } from 'lucide-react';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert', 'in-progress': 'En cours', waiting: 'En attente',
  resolved: 'Résolu', closed: 'Fermé',
};
const CATEGORY_LABELS: Record<string, string> = {
  hardware: 'Matériel', software: 'Logiciel', network: 'Réseau',
  user: 'Utilisateur', other: 'Autre',
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  'in-progress': 1,
  waiting: 2,
  resolved: 3,
  closed: 4,
};

type TicketForm = {
  status: string;
  assignedTo: string;
};

const defaultForm: TicketForm = {
  status: 'open', assignedTo: '',
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-800';
    case 'high':     return 'bg-orange-100 text-orange-800';
    case 'medium':   return 'bg-yellow-100 text-yellow-800';
    case 'low':      return 'bg-blue-100 text-blue-800';
    default:         return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open':        return 'bg-red-100 text-red-800';
    case 'in-progress': return 'bg-blue-100 text-blue-800';
    case 'waiting':     return 'bg-yellow-100 text-yellow-800';
    case 'resolved':
    case 'closed':      return 'bg-green-100 text-green-800';
    default:            return 'bg-gray-100 text-gray-800';
  }
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TicketForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (res.ok) setTickets(data.tickets || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => fetchTickets(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const updateTicket = useCallback(async (id: string, updates: Partial<TicketForm>) => {
    setBusyTicketId(id);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await fetchTickets(true);
      }
    } finally {
      setBusyTicketId(null);
    }
  }, [fetchTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      await fetch(`/api/tickets/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          assignedTo: formData.assignedTo || null,
        }),
      });

      await fetchTickets(true);
      setShowModal(false);
      setEditingId(null);
      setFormData(defaultForm);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (id: string) => {
    await updateTicket(id, { status: 'closed' });
  };

  const openEdit = (ticket: Ticket) => {
    setEditingId(ticket.id);
    setFormData({
      status: ticket.status,
      assignedTo: ticket.assignedTo || '',
    });
    setShowModal(true);
  };

  const filtered = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return tickets
      .filter((ticket) => filterStatus === 'all' || ticket.status === filterStatus)
      .filter((ticket) => filterCategory === 'all' || ticket.category === filterCategory)
      .filter((ticket) => {
        if (!normalizedSearch) return true;

        const haystack = [
          ticket.title,
          ticket.description,
          ticket.createdBy,
          ticket.assignedTo,
          CATEGORY_LABELS[ticket.category],
          PRIORITY_LABELS[ticket.priority],
          STATUS_LABELS[ticket.status],
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const statusDelta = (STATUS_ORDER[left.status] ?? 99) - (STATUS_ORDER[right.status] ?? 99);
        if (statusDelta !== 0) return statusDelta;

        const updatedRight = new Date(right.updatedAt).getTime();
        const updatedLeft = new Date(left.updatedAt).getTime();
        return updatedRight - updatedLeft;
      });
  }, [tickets, filterStatus, filterCategory, searchQuery]);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const criticalCount = tickets.filter((t) => t.priority === 'critical' && t.status !== 'closed').length;
  const triageCount = tickets.filter((t) => t.status === 'open' && !t.assignedTo).length;
  const inProgressCount = tickets.filter((t) => t.status === 'in-progress').length;
  const waitingCount = tickets.filter((t) => t.status === 'waiting').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tickets Helpdesk</h1>
            <p className="text-gray-600 mt-1">
              {openCount} ouvert{openCount !== 1 ? 's' : ''}
              {criticalCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">· {criticalCount} critique{criticalCount !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Nouveaux reçus</p>
            <p className="mt-2 text-3xl font-bold text-red-900">{openCount}</p>
            <p className="mt-1 text-sm text-red-700">Tickets encore ouverts</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">À trier</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">{triageCount}</p>
            <p className="mt-1 text-sm text-amber-700">Ouverts sans assignation</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">En traitement</p>
            <p className="mt-2 text-3xl font-bold text-blue-900">{inProgressCount}</p>
            <p className="mt-1 text-sm text-blue-700">Pris en charge par l'équipe</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">En attente</p>
            <p className="mt-2 text-3xl font-bold text-purple-900">{waitingCount}</p>
            <p className="mt-1 text-sm text-purple-700">Besoin d'un retour ou d'une action</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par titre, description, demandeur ou assignation"
                className="w-full border-0 bg-transparent p-0 text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border-0 bg-transparent text-sm text-gray-700 outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="open">Ouvert</option>
                <option value="in-progress">En cours</option>
                <option value="waiting">En attente</option>
                <option value="resolved">Résolu</option>
                <option value="closed">Fermé</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
              <CircleDot size={16} className="text-gray-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full border-0 bg-transparent text-sm text-gray-700 outline-none"
              >
                <option value="all">Toutes les catégories</option>
                <option value="hardware">Matériel</option>
                <option value="software">Logiciel</option>
                <option value="network">Réseau</option>
                <option value="user">Utilisateur</option>
                <option value="other">Autre</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {['all', 'open', 'in-progress', 'waiting', 'resolved', 'closed'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'Tous' : STATUS_LABELS[s] || s}
                {s === 'open' && openCount > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <h2 className="text-xl font-bold mb-5">
                Mettre à jour le traitement
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="open">Ouvert</option>
                      <option value="in-progress">En cours</option>
                      <option value="waiting">En attente</option>
                      <option value="resolved">Résolu</option>
                      <option value="closed">Fermé</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigné à</label>
                    <input
                      type="text"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Nom du technicien"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? 'Enregistrement...' : 'Mettre à jour'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingId(null); setFormData(defaultForm); }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" />
              Chargement des tickets...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket reçu</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Demandeur</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pilotage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="max-w-md">
                          <div className="text-sm font-medium text-gray-900">{ticket.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-gray-500">{ticket.description || 'Aucune description fournie'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <User size={12} className="text-gray-400" />
                          <span className="max-w-[140px] truncate font-medium">{ticket.createdBy || '—'}</span>
                        </div>
                        <div className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                            {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {STATUS_LABELS[ticket.status] || ticket.status}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {ticket.assignedTo ? (
                            <span>Assigné à <span className="font-medium text-gray-700">{ticket.assignedTo}</span></span>
                          ) : (
                            <span className="text-amber-600 font-medium">Non assigné</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock3 size={12} className="text-gray-400" />
                          Créé le {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Mis à jour le {new Date(ticket.updatedAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {ticket.status === 'open' && (
                            <button
                              onClick={() => updateTicket(ticket.id, { status: 'in-progress' })}
                              disabled={busyTicketId === ticket.id}
                              className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              Prendre en charge
                            </button>
                          )}
                          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                            <button
                              onClick={() => updateTicket(ticket.id, { status: 'resolved' })}
                              disabled={busyTicketId === ticket.id}
                              className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                            >
                              Résoudre
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(ticket)}
                            title="Modifier"
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleClose(ticket.id)}
                            disabled={ticket.status === 'closed' || busyTicketId === ticket.id}
                            title="Fermer le ticket"
                            className={ticket.status === 'closed' ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:text-green-800 transition-colors'}
                          >
                            <CheckCircle size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <ExternalLink size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucun ticket ne correspond aux filtres actuels</p>
                  <p className="text-xs mt-1">Les tickets soumis via le portail helpdesk apparaissent ici automatiquement et peuvent ensuite être triés, assignés puis clôturés.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
