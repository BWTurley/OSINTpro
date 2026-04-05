import React from 'react';
import { WidgetGrid } from '@/components/dashboard/WidgetGrid';

const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-base text-gray-400 mt-1">Intelligence overview and monitoring</p>
      </div>
      <WidgetGrid />
    </div>
  );
};

export default DashboardPage;
