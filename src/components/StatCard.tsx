'use client';

import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  trend,
  color = 'blue'
}) => {
  const accents = {
    blue: {
      ring: 'from-blue-400/25 via-sky-400/25 to-indigo-400/25',
      border: 'border-blue-200/60',
      dot: 'bg-blue-500',
      value: 'text-blue-700',
      iconBg: 'bg-blue-100/80 text-blue-700',
    },
    green: {
      ring: 'from-emerald-400/25 via-green-400/25 to-teal-400/25',
      border: 'border-emerald-200/60',
      dot: 'bg-emerald-500',
      value: 'text-emerald-700',
      iconBg: 'bg-emerald-100/80 text-emerald-700',
    },
    red: {
      ring: 'from-red-400/25 via-rose-400/25 to-orange-400/25',
      border: 'border-red-200/60',
      dot: 'bg-red-500',
      value: 'text-red-700',
      iconBg: 'bg-red-100/80 text-red-700',
    },
    yellow: {
      ring: 'from-amber-300/25 via-yellow-300/25 to-orange-300/25',
      border: 'border-yellow-200/60',
      dot: 'bg-yellow-500',
      value: 'text-yellow-700',
      iconBg: 'bg-yellow-100/80 text-yellow-700',
    },
  };

  const accent = accents[color];

  return (
    <div className="relative group">
      <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${accent.ring} opacity-20 blur-xl group-hover:opacity-40 transition-all`} />
      <div className={`relative rounded-2xl border ${accent.border} bg-white/75 backdrop-blur-xl px-5 py-4 flex items-center justify-between shadow-sm hover:shadow-lg transition-all min-h-[112px]`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${accent.dot} animate-pulse`} />
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{title}</p>
          </div>
          <p className={`text-3xl font-bold mt-2 ${accent.value}`}>{value}</p>
          {trend !== undefined && trend !== null && (
            <p className={`text-xs mt-2 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl ${accent.iconBg} ring-1 ring-white/60 shadow`}> 
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
