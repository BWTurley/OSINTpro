import React, { useState } from 'react';
import { UserManagement } from '@/components/admin/UserManagement';
import { SystemHealth } from '@/components/admin/SystemHealth';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { DataRetention } from '@/components/admin/DataRetention';
import clsx from 'clsx';

const tabs = [
  { id: 'health', label: 'System Health' },
  { id: 'users', label: 'Users' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'retention', label: 'Data Retention' },
] as const;

type TabId = typeof tabs[number]['id'];

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('health');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Administration</h1>
        <p className="text-base text-gray-400 mt-1">System management and configuration</p>
      </div>

      <div className="flex gap-1 border-b border-gray-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-3 text-base font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'health' && <SystemHealth />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'audit' && <AuditLogViewer />}
      {activeTab === 'retention' && <DataRetention />}
    </div>
  );
};

export default AdminPage;
