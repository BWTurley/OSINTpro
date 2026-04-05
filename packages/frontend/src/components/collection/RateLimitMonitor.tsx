import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_MODULE_STATUS } from '@/graphql/queries/collection';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import clsx from 'clsx';
import type { IntelModule } from '@/types';

export const RateLimitMonitor: React.FC = () => {
  const { data, loading } = useQuery(GET_MODULE_STATUS, { pollInterval: 30000 });
  const modules = (data?.intelModules as IntelModule[]) ?? [];

  if (loading) return <LoadingSpinner text="Loading rate limits..." />;

  const chartData = modules
    .filter((m) => m.enabled)
    .map((m) => ({
      name: m.name,
      used: m.rateLimitUsed,
      remaining: Math.max(0, m.rateLimitMax - m.rateLimitUsed),
      max: m.rateLimitMax,
      percentage: m.rateLimitMax > 0 ? Math.round((m.rateLimitUsed / m.rateLimitMax) * 100) : 0,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-100">Rate Limit Usage</h3>
        <p className="text-base text-gray-400 mt-1">API usage across enabled intelligence modules</p>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fill: '#d1d5db', fontSize: 14 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#e5e7eb',
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    name === 'used' ? 'Used' : 'Remaining',
                  ]}
                />
                <Bar dataKey="used" stackId="a" radius={[0, 0, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`used-${index}`}
                      fill={
                        entry.percentage > 90
                          ? '#ef4444'
                          : entry.percentage > 70
                          ? '#f59e0b'
                          : '#3b82f6'
                      }
                    />
                  ))}
                </Bar>
                <Bar dataKey="remaining" stackId="a" fill="#1e293b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.filter((m) => m.enabled).map((mod) => {
          const pct = mod.rateLimitMax > 0 ? (mod.rateLimitUsed / mod.rateLimitMax) * 100 : 0;
          return (
            <div key={mod.id} className="card">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-gray-200">{mod.name}</h4>
                <span
                  className={clsx(
                    'text-2xl font-bold',
                    pct > 90 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-blue-400'
                  )}
                >
                  {Math.round(pct)}%
                </span>
              </div>

              <div className="mt-3 h-3 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>

              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>{mod.rateLimitUsed.toLocaleString()} used</span>
                <span>{mod.rateLimitMax.toLocaleString()} limit</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
