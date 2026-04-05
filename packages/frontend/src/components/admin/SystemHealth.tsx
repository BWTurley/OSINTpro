import React from 'react';
import { Database, HardDrive, Cpu, Activity, Server, Layers } from 'lucide-react';
import { formatFileSize, formatNumber } from '@/utils/formatters';
import clsx from 'clsx';

interface HealthMetric {
  label: string;
  value: string;
  max?: string;
  percentage?: number;
  icon: React.FC<{ className?: string }>;
  status: 'healthy' | 'warning' | 'critical';
}

// Demo data
const metrics: HealthMetric[] = [
  { label: 'PostgreSQL', value: formatFileSize(2.4 * 1024 * 1024 * 1024), max: '50 GB', percentage: 4.8, icon: Database, status: 'healthy' },
  { label: 'Elasticsearch', value: formatFileSize(8.7 * 1024 * 1024 * 1024), max: '100 GB', percentage: 8.7, icon: HardDrive, status: 'healthy' },
  { label: 'Redis Memory', value: formatFileSize(512 * 1024 * 1024), max: '2 GB', percentage: 25, icon: Cpu, status: 'healthy' },
  { label: 'Neo4j', value: formatNumber(145000) + ' nodes', max: '500K', percentage: 29, icon: Layers, status: 'healthy' },
  { label: 'Queue Depth', value: '23 jobs', max: '1000', percentage: 2.3, icon: Activity, status: 'healthy' },
  { label: 'API Response', value: '145ms avg', max: '500ms', percentage: 29, icon: Server, status: 'healthy' },
];

const systemInfo = [
  { label: 'Uptime', value: '14 days, 7 hours' },
  { label: 'Node Version', value: 'v20.11.0' },
  { label: 'Total Entities', value: formatNumber(145283) },
  { label: 'Total Cases', value: '47' },
  { label: 'Active Users', value: '12' },
  { label: 'Collection Modules', value: '8 / 12 healthy' },
];

const statusColors = {
  healthy: 'text-green-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
};

const barColors = {
  healthy: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

export const SystemHealth: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* System info cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {systemInfo.map((info) => (
          <div key={info.label} className="card text-center">
            <p className="text-sm text-gray-500">{info.label}</p>
            <p className="text-lg font-bold text-gray-100 mt-1">{info.value}</p>
          </div>
        ))}
      </div>

      {/* Health metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className={clsx('p-2 rounded-lg', metric.status === 'healthy' ? 'bg-green-500/10' : metric.status === 'warning' ? 'bg-amber-500/10' : 'bg-red-500/10')}>
                <metric.icon className={clsx('h-5 w-5', statusColors[metric.status])} />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-gray-200">{metric.label}</h4>
              </div>
              <span className={clsx('text-sm font-medium capitalize', statusColors[metric.status])}>
                {metric.status}
              </span>
            </div>

            <div className="flex items-end justify-between mb-2">
              <span className="text-xl font-bold text-gray-100">{metric.value}</span>
              {metric.max && (
                <span className="text-sm text-gray-500">/ {metric.max}</span>
              )}
            </div>

            {metric.percentage !== undefined && (
              <div className="h-2.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all', barColors[metric.status])}
                  style={{ width: `${Math.min(100, metric.percentage)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
