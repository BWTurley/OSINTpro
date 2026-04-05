import React from 'react';
import { CaseList } from '@/components/cases/CaseList';

const CasesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Cases</h1>
        <p className="text-base text-gray-400 mt-1">Investigation case management</p>
      </div>
      <CaseList />
    </div>
  );
};

export default CasesPage;
