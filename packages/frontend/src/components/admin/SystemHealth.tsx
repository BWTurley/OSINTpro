import React, { useState, useEffect } from 'react';
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

interface HealthData {
  status: string;
  services?: Record<string, { status: string; details?: string }>;
  uptime?: string;
  version?: string;
  [key: string]: unknown;
}

function buildMetrics(data: HealthData): HealthMetric[] {
  const services = data.services ?? {};
  const result: HealthMetric[] = [];
  const icons: Record<string, React.FC<{ className?: string }>> = {
    postgres: Database, elasticsearch: HardDrive, redis: Cpu,
    neo4j: Layers, queue: Activity, api: Server,
  };
  for (const [name, svc] of Object.entries(services)) {
    const status = svc.status === 'healthy' ? 'healthy' : svc.status === 'degraded' ? 'warning' : 'critical';
    result.push({
      label: name.charAt(0).toUpperCase() + name.slice(1),
      value: svc.details ?? svc.status,
      icon: icons[name] ?? Server,
      status,
    });
  }
  if (result.length === 0) {
    result.push({ label: 'API', value: data.status, icon: Server, status: data.status === 'ok' ? 'healthy' : 'warning' });
  }
  return result;
}

function buildSystemInfo(data: HealthData): Array<{ label: string; value: string }> {
  const info: Array<{ label: string; value: string }> = [];
  if (data.uptime) info.push({ label: 'Uptime', value: data.uptime });
  if (data.version) info.push({ label: 'Node Version', value: data.version });
  return info;
}

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
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [systemInfo, setSystemInfo] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    fetch('/health/ready')
      .then((res) => res.json())
      .then((data: HealthData) => {
        setMetrics(buildMetrics(data));
        setSystemInfo(buildSystemInfo(data));
      })
      .catch((err) => console.error('Failed to load health data:', err));
  }, []);

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
