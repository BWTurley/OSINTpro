import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_STATS } from '@/graphql/queries/search';
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import type { DashboardStats } from '@/types';

export const ActiveAlerts: React.FC = () => {
  const { data } = useQuery(GET_DASHBOARD_STATS, { pollInterval: 15000 });
  const stats = data?.dashboardStats as DashboardStats | undefined;

  const alertLevels = [
    {
      label: 'Critical',
      count: stats?.alertsCritical ?? 0,
      icon: ShieldAlert,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      ring: 'ring-red-500/30',
    },
    {
      label: 'High',
      count: stats?.alertsHigh ?? 0,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      ring: 'ring-orange-500/30',
    },
    {
      label: 'Medium',
      count: stats?.alertsMedium ?? 0,
      icon: AlertCircle,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      ring: 'ring-yellow-500/30',
    },
    {
      label: 'Low',
      count: stats?.alertsLow ?? 0,
      icon: Info,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      ring: 'ring-green-500/30',
    },
  ];

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">Active Alerts</h3>
      <div className="grid grid-cols-2 gap-4">
        {alertLevels.map((level) => (
          <div
            key={level.label}
            className={`flex items-center gap-3 p-4 rounded-lg ${level.bg} ring-1 ${level.ring}`}
          >
            <level.icon className={`h-6 w-6 ${level.color}`} />
            <div>
              <p className={`text-2xl font-bold ${level.color}`}>{level.count}</p>
              <p className="text-sm text-gray-400">{level.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
