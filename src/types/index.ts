// Types pour les adresses IP
export interface IPAddress {
  id: string;
  address: string;
  subnet: string;
  gateway: string;
  dnsServers: string[];
  isActive: boolean;
  assignedTo?: string;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les équipements informatiques
export interface Equipment {
  id: string;
  name: string;
  type: 'laptop' | 'printer' | 'phone' | 'network' | 'other';
  serialNumber: string;
  hardwareId?: string; // IMEI ou équivalent
  ipAddress?: string;
  status: 'in-service' | 'stock';
  assignedToUser?: string; // ID de l'utilisateur si en service
  dateInService?: Date; // Date de mise en service
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les utilisateurs
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'technician' | 'user';
  department: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour la supervision du serveur
export interface ServerMetrics {
  id: string;
  serverId: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  processCount: number;
  uptime: number;
  temperature?: number;
  timestamp: Date;
}

export interface ServerStatus {
  id: string;
  name: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'warning';
  healthScore: number;
  metrics: ServerMetrics;
  lastHealthCheck: Date;
  services: ServiceStatus[];
}

export interface ServiceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'warning';
  port?: number;
  memory?: number;
  uptime?: number;
}

// Types pour les tickets Helpdesk
export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'waiting' | 'resolved' | 'closed';
  category: 'hardware' | 'software' | 'network' | 'user' | 'other';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  comments: Comment[];
}

export interface Comment {
  id: string;
  ticketId: string;
  author: string;
  content: string;
  createdAt: Date;
}

// Type pour les alertes
export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

// Type pour les statistiques du dashboard
export interface DashboardStats {
  totalEquipment: number;
  operationalEquipment: number;
  offlineEquipment: number;
  totalUsers: number;
  activeUsers: number;
  totalTickets: number;
  openTickets: number;
  criticalTickets: number;
  serverHealthScore: number;
  ipUtilization: number;
  activeAlerts: number;
}
