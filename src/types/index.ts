// Types pour les adresses IP
export type IPAddressStatus = 'free' | 'assigned' | 'reserved' | 'conflict';

export interface IPAddress {
  id: string;
  address: string;
  status: IPAddressStatus;
  subnet: string;          // CIDR référence, ex: "192.168.1.0/24"
  linkedMachine?: string;  // nom ou ID de l'équipement lié
  linkedUser?: string;     // nom ou ID de l'utilisateur lié
  linkedService?: string;  // service / département
  comment?: string;
  lastSeen?: Date;
  updatedAt: Date;
  updatedBy?: string;      // auteur de la dernière modification
  createdAt: Date;
}

export interface IPAddressHistory {
  id: string;
  ipAddressId: string;
  address: string;
  action: 'create' | 'update' | 'delete';
  changedBy: string;
  changedAt: Date;
  oldValue?: string;
  newValue?: string;
}

// Types pour les sous-réseaux
export interface Subnet {
  id: string;
  name: string;
  mainNetworkCidr: string;
  subnetCidr: string;
  networkAddress: string;
  prefix: number;
  netmask: string;
  rangeStart: string;
  rangeEnd: string;
  usableHosts: number;
  allocation: string;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les équipements informatiques
export type EquipmentType = 'pc' | 'server' | 'printer' | 'phone' | 'network' | 'other';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  serialNumber: string;
  hardwareId?: string; // IMEI ou équivalent
  ipAddress?: string;
  status: 'in-service' | 'stock';
  assignedToUser?: string; // ID de l'utilisateur si en service
  departmentService?: string; // Département/Service si en service
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
    subnetMask?: string;
  healthScore: number;
  metrics: ServerMetrics;
  lastHealthCheck: Date;
  services: ServiceStatus[];
    diskTotal?: number;
    diskFree?: number;
    memTotal?: number;
    memFree?: number;
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

// Types pour la gestion des logs
export type LogCategory = 'system' | 'user' | 'action' | 'security';
export type LogLevel = 'info' | 'warning' | 'error' | 'critical';

export interface SystemLog {
  id: string;
  timestamp: Date;
  category: LogCategory;
  level: LogLevel;
  username?: string;
  module: string;
  action: string;
  objectImpacted: string;
  oldValue?: string;
  newValue?: string;
  ipSource?: string;
  details?: Record<string, any>;
  resolved?: boolean;
}

export interface LogFilter {
  category?: LogCategory;
  level?: LogLevel;
  module?: string;
  username?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

export interface LogStats {
  totalLogs: number;
  systemLogs: number;
  userLogs: number;
  actionLogs: number;
  securityLogs: number;
  criticalCount: number;
  errorCount: number;
  lastLogTime?: Date;
}
