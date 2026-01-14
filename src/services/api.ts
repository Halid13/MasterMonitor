import axios from 'axios';
import {
  Equipment,
  User,
  Ticket,
  ServerStatus,
  Alert,
  IPAddress,
  DashboardStats,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Equipment Services
export const equipmentService = {
  getAll: async () => {
    const response = await api.get<Equipment[]>('/equipment');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<Equipment>(`/equipment/${id}`);
    return response.data;
  },
  create: async (equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const response = await api.post<Equipment>('/equipment', equipment);
    return response.data;
  },
  update: async (id: string, equipment: Partial<Equipment>) => {
    const response = await api.put<Equipment>(`/equipment/${id}`, equipment);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/equipment/${id}`);
  },
};

// User Services
export const userService = {
  getAll: async () => {
    const response = await api.get<User[]>('/users');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },
  create: async (user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>) => {
    const response = await api.post<User>('/users', user);
    return response.data;
  },
  update: async (id: string, user: Partial<User>) => {
    const response = await api.put<User>(`/users/${id}`, user);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/users/${id}`);
  },
};

// Ticket Services
export const ticketService = {
  getAll: async () => {
    const response = await api.get<Ticket[]>('/tickets');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<Ticket>(`/tickets/${id}`);
    return response.data;
  },
  create: async (ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) => {
    const response = await api.post<Ticket>('/tickets', ticket);
    return response.data;
  },
  update: async (id: string, ticket: Partial<Ticket>) => {
    const response = await api.put<Ticket>(`/tickets/${id}`, ticket);
    return response.data;
  },
  close: async (id: string) => {
    const response = await api.put<Ticket>(`/tickets/${id}/close`, {});
    return response.data;
  },
};

// Server Services
export const serverService = {
  getAll: async () => {
    const response = await api.get<ServerStatus[]>('/servers');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<ServerStatus>(`/servers/${id}`);
    return response.data;
  },
  getMetrics: async (serverId: string) => {
    const response = await api.get(`/servers/${serverId}/metrics`);
    return response.data;
  },
};

// Alert Services
export const alertService = {
  getAll: async () => {
    const response = await api.get<Alert[]>('/alerts');
    return response.data;
  },
  getActive: async () => {
    const response = await api.get<Alert[]>('/alerts/active');
    return response.data;
  },
  resolve: async (id: string) => {
    const response = await api.put<Alert>(`/alerts/${id}/resolve`, {});
    return response.data;
  },
};

// IP Address Services
export const ipService = {
  getAll: async () => {
    const response = await api.get<IPAddress[]>('/ip-addresses');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<IPAddress>(`/ip-addresses/${id}`);
    return response.data;
  },
  create: async (ip: Omit<IPAddress, 'id' | 'createdAt' | 'updatedAt'>) => {
    const response = await api.post<IPAddress>('/ip-addresses', ip);
    return response.data;
  },
  update: async (id: string, ip: Partial<IPAddress>) => {
    const response = await api.put<IPAddress>(`/ip-addresses/${id}`, ip);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/ip-addresses/${id}`);
  },
};

// Dashboard Statistics
export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },
};

export default api;
