'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import MainLayout from '@/components/MainLayout';
import { Ticket } from '@/types';
import { Edit2, RefreshCw, ExternalLink, User, Search, Filter, Clock3, CircleDot, Monitor } from 'lucide-react';

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

const normalizeStatus = (value: unknown): Ticket['status'] | null => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const compact = raw.replace(/[\s_\-/]+/g, '');

  if (compact.includes('open') || compact.includes('ouvert')) return 'open';
  if (compact.includes('inprogress') || compact.includes('encours')) return 'in-progress';
  if (compact.includes('waiting') || compact.includes('pending') || compact.includes('enattente')) return 'waiting';
  if (compact.includes('resolu') || compact.includes('resolue') || compact.includes('resolved')) return 'resolved';
  if (compact.includes('closed') || compact.includes('ferme') || compact.includes('fermee')) return 'closed';
  return null;
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
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/tickets', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        const normalized = (data.tickets || []).map((ticket: Ticket) => {
          const mappedStatus = normalizeStatus(ticket.status);
          return {
            ...ticket,
            status: mappedStatus ?? ticket.status,
          };
        });
        setTickets(normalized);
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/tickets/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: normalizeStatus(formData.status) ?? formData.status,
          assignedTo: formData.assignedTo || null,
        }),
      });

      if (!response.ok) {
        throw new Error('La mise a jour du ticket a echoue');
      }

      // Optimistic immediate update
      const now = new Date();
      const newStatus = (normalizeStatus(formData.status) ?? formData.status) as Ticket['status'];
      const newAssignedTo = formData.assignedTo || undefined;
      setTickets(prev => prev.map(t =>
        t.id === editingId
          ? { ...t, status: newStatus, assignedTo: newAssignedTo, updatedAt: now }
          : t
      ));
      setSelectedTicket(prev => prev?.id === editingId
        ? { ...prev, status: newStatus, assignedTo: newAssignedTo, updatedAt: now }
        : prev
      );

      setShowModal(false);
      setEditingId(null);
      setFormData(defaultForm);
      await fetchTickets(true);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (ticket: Ticket) => {
    setEditingId(ticket.id);
    setFormData({
      status: (normalizeStatus(ticket.status) ?? ticket.status) as Ticket['status'],
      assignedTo: ticket.assignedTo || '',
    });
    setShowModal(true);
  };

  const openDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowDetails(true);
  };

  const filtered = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return tickets
      .filter((ticket) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'done') return ticket.status === 'resolved' || ticket.status === 'closed';
        return ticket.status === filterStatus;
      })
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
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Centre Opérations</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Tickets Helpdesk</h1>
              <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-500">
                <span>{openCount} ouvert{openCount !== 1 ? 's' : ''}</span>
                {criticalCount > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                    {criticalCount} critique{criticalCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Nouveaux reçus</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{openCount}</p>
              <p className="text-xs text-slate-500">Tickets ouverts</p>
            </article>
            <article className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">À trier</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{triageCount}</p>
              <p className="text-xs text-slate-500">Sans assignation</p>
            </article>
            <article className="rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700">En traitement</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{inProgressCount}</p>
              <p className="text-xs text-slate-500">Pris en charge</p>
            </article>
            <article className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">En attente</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{waitingCount}</p>
              <p className="text-xs text-slate-500">En attente d'action</p>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2.5 focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par titre, description, demandeur"
                className="w-full border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2.5">
              <Filter size={16} className="text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="open">Ouvert</option>
                <option value="in-progress">En cours</option>
                <option value="waiting">En attente</option>
                <option value="done">Résolu / Fermé</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2.5">
              <CircleDot size={16} className="text-slate-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
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

          <div className="mt-3 flex flex-wrap gap-2">
            {['all', 'open', 'in-progress', 'waiting', 'done'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  filterStatus === s
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'Tous' : s === 'done' ? 'Résolu / Fermé' : STATUS_LABELS[s] || s}
                {s === 'open' && openCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-xs text-white">
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/15 backdrop-blur-sm p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h2 className="mb-5 text-xl font-semibold text-slate-900">Mettre à jour le traitement</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="open">Ouvert</option>
                      <option value="in-progress">En cours</option>
                      <option value="waiting">En attente</option>
                      <option value="resolved">Résolu</option>
                      <option value="closed">Fermé</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Assigné à</label>
                    <input
                      type="text"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Nom du technicien"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {saving ? 'Enregistrement...' : 'Mettre à jour'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingId(null); setFormData(defaultForm); }}
                    className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-200"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Détail ticket */}
        {showDetails && selectedTicket && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/15 backdrop-blur-sm p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Détail du ticket</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedTicket.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openEdit(selectedTicket);
                    setShowDetails(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-700"
                >
                  <Edit2 size={14} />
                  Modifier traitement
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titre</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedTicket.title}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {selectedTicket.description || 'Aucune description fournie'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demandeur</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedTicket.createdBy || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigné à</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedTicket.assignedTo || 'Non assigné'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catégorie</p>
                    <p className="mt-1 text-sm text-slate-800">{CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priorité</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                      {PRIORITY_LABELS[selectedTicket.priority] || selectedTicket.priority}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                      {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créé le</p>
                    <p className="mt-1 text-sm text-slate-800">{new Date(selectedTicket.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <Monitor size={13} className="text-slate-400" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Machine du demandeur</p>
                  </div>
                  {selectedTicket.requesterMachine ? (
                    <div className="mt-1 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Modèle</p>
                        <p className="mt-0.5 text-sm text-slate-800">
                          {selectedTicket.requesterMachine.model || selectedTicket.requesterMachine.name || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Adresse IP</p>
                        <p className="mt-0.5 font-mono text-sm text-slate-800">
                          {selectedTicket.requesterMachine.ipAddress || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Numéro de série</p>
                        <p className="mt-0.5 font-mono text-sm text-slate-800">
                          {selectedTicket.requesterMachine.serialNumber || '—'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      Aucune machine associée à ce demandeur
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dernière mise à jour</p>
                  <p className="mt-1 text-sm text-slate-800">{new Date(selectedTicket.updatedAt).toLocaleString('fr-FR')}</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedTicket(null);
                  }}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" />
              Chargement des tickets...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Priorité</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Catégorie</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Assigné à</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Date de réception</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => openDetails(ticket)}
                      className="cursor-pointer transition hover:bg-cyan-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="max-w-md">
                          <div className="text-sm font-medium text-slate-900">{ticket.title}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <User size={12} className="text-slate-400" />
                            <span className="truncate max-w-[200px]">{ticket.createdBy || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                          {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ticket.assignedTo || <span className="font-medium text-amber-600">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock3 size={12} className="text-slate-400" />
                          {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-slate-400">
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