'use client';

import { create } from 'zustand';
import { Equipment, User, Ticket, ServerStatus, Alert, IPAddress, Subnet } from '@/types';

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
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Equipment
  equipment: [],
  setEquipment: (equipment) => set({ equipment }),
  addEquipment: (equipment) =>
    set((state) => ({ equipment: [...state.equipment, equipment] })),
  updateEquipment: (id, equipment) =>
    set((state) => ({
      equipment: state.equipment.map((e) => (e.id === id ? { ...e, ...equipment } : e)),
    })),
  deleteEquipment: (id) =>
    set((state) => ({ equipment: state.equipment.filter((e) => e.id !== id) })),

  // Users
  users: [],
  setUsers: (users) => set({ users }),
  addUser: (user) =>
    set((state) => ({ users: [...state.users, user] })),
  updateUser: (id, user) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, ...user } : u)),
    })),
  deleteUser: (id) =>
    set((state) => ({ users: state.users.filter((u) => u.id !== id) })),

  // Tickets
  tickets: [],
  setTickets: (tickets) => set({ tickets }),
  addTicket: (ticket) =>
    set((state) => ({ tickets: [...state.tickets, ticket] })),
  updateTicket: (id, ticket) =>
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? { ...t, ...ticket } : t)),
    })),
  closeTicket: (id) =>
    set((state) => ({
      tickets: state.tickets.map((t) =>
        t.id === id ? { ...t, status: 'closed' as const, resolvedAt: new Date() } : t,
      ),
    })),

  // Server Status
  servers: [],
  setServers: (servers) => set({ servers }),
  updateServerStatus: (id, status) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...status } : s)),
    })),

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => ({ alerts: [...state.alerts, alert] })),
  resolveAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, isResolved: true, resolvedAt: new Date() } : a,
      ),
    })),

  // IP Addresses
  ipAddresses: [],
  setIPAddresses: (ips) => set({ ipAddresses: ips }),
  addIPAddress: (ip) =>
    set((state) => ({ ipAddresses: [...state.ipAddresses, ip] })),
  updateIPAddress: (id, ip) =>
    set((state) => ({
      ipAddresses: state.ipAddresses.map((i) => (i.id === id ? { ...i, ...ip } : i)),
    })),
  deleteIPAddress: (id) =>
    set((state) => ({ ipAddresses: state.ipAddresses.filter((i) => i.id !== id) })),

  // Subnets
  subnets: [],
  setSubnets: (subnets) => set({ subnets }),
  addSubnet: (subnet) =>
    set((state) => ({ subnets: [...state.subnets, subnet] })),
  updateSubnet: (id, subnet) =>
    set((state) => ({
      subnets: state.subnets.map((s) => (s.id === id ? { ...s, ...subnet } : s)),
    })),
  deleteSubnet: (id) =>
    set((state) => ({ subnets: state.subnets.filter((s) => s.id !== id) })),

  // Filter and Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  filterCategory: '',
  setFilterCategory: (category) => set({ filterCategory: category }),
}));
