import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Demo data -- in production this comes from a query
const generateHourlyData = () => {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      completed: Math.floor(Math.random() * 50) + 10,
      failed: Math.floor(Math.random() * 5),
    });
  }
  return data;
};

const hourlyData = generateHourlyData();

export const CollectionActivity: React.FC = () => {
  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">Collection Activity (24h)</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hourlyData}>
            <defs>
              <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              interval={5}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#e5e7eb',
              }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#3b82f6"
              fill="url(#completedGrad)"
              strokeWidth={2}
              name="Completed"
            />
            <Area
              type="monotone"
              dataKey="failed"
              stroke="#ef4444"
              fill="url(#failedGrad)"
              strokeWidth={2}
              name="Failed"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
