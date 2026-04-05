import React, { useState } from 'react';
import { ModuleConfig } from '@/components/collection/ModuleConfig';
import { JobQueue } from '@/components/collection/JobQueue';
import { ScheduledJobs } from '@/components/collection/ScheduledJobs';
import { RateLimitMonitor } from '@/components/collection/RateLimitMonitor';
import clsx from 'clsx';

const tabs = [
  { id: 'queue', label: 'Job Queue' },
  { id: 'modules', label: 'Modules' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'limits', label: 'Rate Limits' },
] as const;

type TabId = typeof tabs[number]['id'];

const CollectionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('queue');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Collection Manager</h1>
        <p className="text-base text-gray-400 mt-1">Intelligence collection modules and job queue</p>
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

      {activeTab === 'queue' && <JobQueue />}
      {activeTab === 'modules' && <ModuleConfig />}
      {activeTab === 'scheduled' && <ScheduledJobs />}
      {activeTab === 'limits' && <RateLimitMonitor />}
    </div>
  );
};

export default CollectionPage;
