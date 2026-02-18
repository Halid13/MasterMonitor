'use client';

import { create } from 'zustand';
import { Equipment, User, Ticket, ServerStatus, Alert, IPAddress, Subnet, SystemLog, LogFilter } from '@/types';

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
  oldValue?: string;
  newValue?: string;
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

interface DashboardStore {
  // Equipment
  equipment: Equipment[];
  setEquipment: (equipment: Equipment[]) => void;
  addEquipment: (equipment: Equipment) => void;
  updateEquipment: (id: string, equipment: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;

  // Users
  users: User[];
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Tickets
  tickets: Ticket[];
  setTickets: (tickets: Ticket[]) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicket: (id: string, ticket: Partial<Ticket>) => void;
  closeTicket: (id: string) => void;

  // Server Status
  servers: ServerStatus[];
  setServers: (servers: ServerStatus[]) => void;
  addServer: (server: ServerStatus) => void;
  deleteServer: (id: string) => void;
  updateServerStatus: (id: string, status: Partial<ServerStatus>) => void;

  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  resolveAlert: (id: string) => void;

  // IP Addresses
  ipAddresses: IPAddress[];
  setIPAddresses: (ips: IPAddress[]) => void;
  addIPAddress: (ip: IPAddress) => void;
  updateIPAddress: (id: string, ip: Partial<IPAddress>) => void;
  deleteIPAddress: (id: string) => void;

  // Subnets
  subnets: Subnet[];
  setSubnets: (subnets: Subnet[]) => void;
  addSubnet: (subnet: Subnet) => void;
  updateSubnet: (id: string, subnet: Partial<Subnet>) => void;
  deleteSubnet: (id: string) => void;

  // Filter and Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;

  // Logs
  logs: SystemLog[];
  setLogs: (logs: SystemLog[]) => void;
  addLog: (log: SystemLog) => void;
  clearLogs: () => void;
  searchLogs: (filter: LogFilter) => SystemLog[];
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Equipment
  equipment: [],
  setEquipment: (equipment) => set({ equipment }),
  addEquipment: (equipment) =>
    set((state) => {
      postLog({
        category: 'action',
        level: 'info',
        module: 'Equipment',
        action: 'create',
        objectImpacted: equipment.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ name: equipment.name, type: equipment.type }),
      });
      const newAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: 'Nouvel équipement',
        message: `${equipment.name} (${equipment.type}) a été ajouté`,
        type: 'info' as const,
        source: 'Equipment',
        isResolved: false,
        createdAt: new Date(),
      };
      return {
        equipment: [...state.equipment, equipment],
        alerts: [newAlert, ...state.alerts],
      };
    }),
  updateEquipment: (id, equipment) =>
    set((state) => {
      const previous = state.equipment.find((e) => e.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'Equipment',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ name: previous.name, type: previous.type }) : undefined,
        newValue: JSON.stringify(equipment),
      });
      const updatedName = equipment.name || previous?.name || id;
      const updatedType = equipment.type || previous?.type || 'unknown';
      const updateAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: 'Équipement modifié',
        message: `${updatedName} (${updatedType}) a été mis à jour`,
        type: 'warning' as const,
        source: 'Equipment',
        isResolved: false,
        createdAt: new Date(),
      };
      return {
        equipment: state.equipment.map((e) => (e.id === id ? { ...e, ...equipment } : e)),
        alerts: [updateAlert, ...state.alerts],
      };
    }),
  deleteEquipment: (id) =>
    set((state) => {
      const previous = state.equipment.find((e) => e.id === id);
      postLog({
        category: 'action',
        level: 'warning',
        module: 'Equipment',
        action: 'delete',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ name: previous.name, type: previous.type }) : undefined,
      });
      const deleteName = previous?.name || id;
      const deleteType = previous?.type || 'unknown';
      const deleteAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: 'Équipement supprimé',
        message: `${deleteName} (${deleteType}) a été supprimé`,
        type: 'error' as const,
        source: 'Equipment',
        isResolved: false,
        createdAt: new Date(),
      };
      return {
        equipment: state.equipment.filter((e) => e.id !== id),
        alerts: [deleteAlert, ...state.alerts],
      };
    }),

  // Users
  users: [],
  setUsers: (users) => set({ users }),
  addUser: (user) =>
    set((state) => {
      postLog({
        category: 'action',
        level: 'info',
        module: 'User',
        action: 'create',
        objectImpacted: user.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ username: user.username, email: user.email, role: user.role }),
      });
      return { users: [...state.users, user] };
    }),
  updateUser: (id, user) =>
    set((state) => {
      const previous = state.users.find((u) => u.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'User',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ username: previous.username, email: previous.email, role: previous.role }) : undefined,
        newValue: JSON.stringify(user),
      });
      return {
        users: state.users.map((u) => (u.id === id ? { ...u, ...user } : u)),
      };
    }),
  deleteUser: (id) =>
    set((state) => {
      const previous = state.users.find((u) => u.id === id);
      postLog({
        category: 'action',
        level: 'warning',
        module: 'User',
        action: 'delete',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ username: previous.username, email: previous.email, role: previous.role }) : undefined,
      });
      return { users: state.users.filter((u) => u.id !== id) };
    }),

  // Tickets
  tickets: [],
  setTickets: (tickets) => set({ tickets }),
  addTicket: (ticket) =>
    set((state) => {
      postLog({
        category: 'action',
        level: 'info',
        module: 'Ticket',
        action: 'create',
        objectImpacted: ticket.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ title: ticket.title, priority: ticket.priority, status: ticket.status }),
      });
      return { tickets: [...state.tickets, ticket] };
    }),
  updateTicket: (id, ticket) =>
    set((state) => {
      const previous = state.tickets.find((t) => t.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'Ticket',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ title: previous.title, priority: previous.priority, status: previous.status }) : undefined,
        newValue: JSON.stringify(ticket),
      });
      return {
        tickets: state.tickets.map((t) => (t.id === id ? { ...t, ...ticket } : t)),
      };
    }),
  closeTicket: (id) =>
    set((state) => {
      const previous = state.tickets.find((t) => t.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'Ticket',
        action: 'stop',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ status: previous.status }) : undefined,
        newValue: JSON.stringify({ status: 'closed' }),
      });
      return {
        tickets: state.tickets.map((t) =>
          t.id === id ? { ...t, status: 'closed' as const, resolvedAt: new Date() } : t,
        ),
      };
    }),

  // Server Status
  servers: [],
  setServers: (servers) => set({ servers }),
  addServer: (server) =>
    set((state) => {
      postLog({
        category: 'action',
        level: 'info',
        module: 'Server',
        action: 'create',
        objectImpacted: server.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ name: server.name, ipAddress: server.ipAddress, status: server.status }),
      });
      return { servers: [...state.servers, server] };
    }),
  deleteServer: (id) =>
    set((state) => {
      const previous = state.servers.find((s) => s.id === id);
      postLog({
        category: 'action',
        level: 'warning',
        module: 'Server',
        action: 'delete',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ name: previous.name, ipAddress: previous.ipAddress, status: previous.status }) : undefined,
      });
      return { servers: state.servers.filter((s) => s.id !== id) };
    }),
  updateServerStatus: (id, status) =>
    set((state) => {
      const previous = state.servers.find((s) => s.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'Server',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ status: previous.status, healthScore: previous.healthScore }) : undefined,
        newValue: JSON.stringify(status),
      });
      return {
        servers: state.servers.map((s) => (s.id === id ? { ...s, ...status } : s)),
      };
    }),

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => {
      postLog({
        category: 'action',
        level: alert.type === 'critical' ? 'critical' : alert.type === 'error' ? 'error' : 'warning',
        module: 'Alert',
        action: 'create',
        objectImpacted: alert.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ title: alert.title, type: alert.type, source: alert.source }),
      });
      return { alerts: [...state.alerts, alert] };
    }),
  resolveAlert: (id) =>
    set((state) => {
      const previous = state.alerts.find((a) => a.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'Alert',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ isResolved: previous.isResolved }) : undefined,
        newValue: JSON.stringify({ isResolved: true }),
      });
      return {
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, isResolved: true, resolvedAt: new Date() } : a,
        ),
      };
    }),

  // IP Addresses
  ipAddresses: [],
  setIPAddresses: (ips) => set({ ipAddresses: ips }),
  addIPAddress: (ip) =>
    set((state) => {
      postLog({
        category: 'action',
        level: 'info',
        module: 'IPAddress',
        action: 'create',
        objectImpacted: ip.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ address: ip.address, subnet: ip.subnet, assignedTo: ip.assignedTo }),
      });
      return { ipAddresses: [...state.ipAddresses, ip] };
    }),
  updateIPAddress: (id, ip) =>
    set((state) => {
      const previous = state.ipAddresses.find((i) => i.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'IPAddress',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ address: previous.address, subnet: previous.subnet, assignedTo: previous.assignedTo }) : undefined,
        newValue: JSON.stringify(ip),
      });
      return {
        ipAddresses: state.ipAddresses.map((i) => (i.id === id ? { ...i, ...ip } : i)),
      };
    }),
  deleteIPAddress: (id) =>
    set((state) => {
      const previous = state.ipAddresses.find((i) => i.id === id);
      postLog({
        category: 'action',
        level: 'warning',
        module: 'IPAddress',
        action: 'delete',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ address: previous.address, subnet: previous.subnet, assignedTo: previous.assignedTo }) : undefined,
      });
      return { ipAddresses: state.ipAddresses.filter((i) => i.id !== id) };
    }),

  // Subnets
  subnets: [],
  setSubnets: (subnets) => set({ subnets }),
  addSubnet: (subnet) =>
    set((state) => {
      postLog({
        category: 'action',
        level: 'info',
        module: 'Subnet',
        action: 'create',
        objectImpacted: subnet.id,
        username: getCurrentUsername(),
        newValue: JSON.stringify({ name: subnet.name, subnetCidr: subnet.subnetCidr, rangeStart: subnet.rangeStart, rangeEnd: subnet.rangeEnd }),
      });
      return { subnets: [...state.subnets, subnet] };
    }),
  updateSubnet: (id, subnet) =>
    set((state) => {
      const previous = state.subnets.find((s) => s.id === id);
      postLog({
        category: 'action',
        level: 'info',
        module: 'Subnet',
        action: 'update',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ name: previous.name, subnetCidr: previous.subnetCidr, rangeStart: previous.rangeStart, rangeEnd: previous.rangeEnd }) : undefined,
        newValue: JSON.stringify(subnet),
      });
      return {
        subnets: state.subnets.map((s) => (s.id === id ? { ...s, ...subnet } : s)),
      };
    }),
  deleteSubnet: (id) =>
    set((state) => {
      const previous = state.subnets.find((s) => s.id === id);
      postLog({
        category: 'action',
        level: 'warning',
        module: 'Subnet',
        action: 'delete',
        objectImpacted: id,
        username: getCurrentUsername(),
        oldValue: previous ? JSON.stringify({ name: previous.name, subnetCidr: previous.subnetCidr, rangeStart: previous.rangeStart, rangeEnd: previous.rangeEnd }) : undefined,
      });
      return { subnets: state.subnets.filter((s) => s.id !== id) };
    }),

  // Filter and Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  filterCategory: '',
  setFilterCategory: (category) => set({ filterCategory: category }),

  // Logs
  logs: [],
  setLogs: (logs) => set({ logs }),
  addLog: (log) =>
    set((state) => ({ logs: [log, ...state.logs].slice(0, 10000) })), // Keep last 10k logs
  clearLogs: () => set({ logs: [] }),
  searchLogs: (filter: LogFilter) => {
    return new Set<SystemLog>([]).size; // Will be implemented in component
  },
}));
