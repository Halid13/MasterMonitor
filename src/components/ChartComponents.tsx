'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Graphique linéaire pour les métriques CPU/RAM/Disque
export const MetricsLineChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="time" stroke="#6b7280" />
      <YAxis stroke="#6b7280" />
      <Tooltip
        contentStyle={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#fff',
        }}
      />
      <Legend />
      <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="memory" stroke="#ef4444" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="disk" stroke="#f59e0b" strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

// Graphique en aire pour la charge serveur
export const ServerLoadChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
      <defs>
        <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="time" stroke="#6b7280" />
      <YAxis stroke="#6b7280" />
      <Tooltip
        contentStyle={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#fff',
        }}
      />
      <Area
        type="monotone"
        dataKey="load"
        stroke="#3b82f6"
        fillOpacity={1}
        fill="url(#colorLoad)"
      />
    </AreaChart>
  </ResponsiveContainer>
);

// Graphique en barres pour les tickets
export const TicketsBarChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="name" stroke="#6b7280" />
      <YAxis stroke="#6b7280" />
      <Tooltip
        contentStyle={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#fff',
        }}
      />
      <Legend />
      <Bar dataKey="open" fill="#ef4444" name="Ouverts" />
      <Bar dataKey="inProgress" fill="#f59e0b" name="En cours" />
      <Bar dataKey="closed" fill="#10b981" name="Fermés" />
    </BarChart>
  </ResponsiveContainer>
);

// Graphique circulaire pour les statuts
export const StatusPieChart = ({ data }: { data: any[] }) => (
  <div className="flex flex-col items-center">
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#fff',
          }}
          formatter={(value) => `${value} équipements`}
        />
      </PieChart>
    </ResponsiveContainer>
    
    {/* Légende personnalisée */}
    <div className="flex flex-wrap justify-center gap-6 mt-4">
      {data.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-700">
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Graphique temps réel pour le trafic réseau
export const NetworkTrafficChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="time" stroke="#6b7280" />
      <YAxis stroke="#6b7280" />
      <Tooltip
        contentStyle={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#fff',
        }}
      />
      <Legend />
      <Line type="monotone" dataKey="incoming" stroke="#10b981" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="outgoing" stroke="#8b5cf6" strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);
