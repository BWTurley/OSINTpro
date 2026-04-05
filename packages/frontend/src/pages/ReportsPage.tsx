import React from 'react';
import { ReportBuilder } from '@/components/reports/ReportBuilder';

const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Reports</h1>
        <p className="text-base text-gray-400 mt-1">Generate intelligence reports and assessments</p>
      </div>
      <ReportBuilder />
    </div>
  );
};

export default ReportsPage;
