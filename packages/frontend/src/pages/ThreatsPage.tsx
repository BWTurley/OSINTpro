import React, { useState } from 'react';
import { IOCFeedView } from '@/components/threats/IOCFeedView';
import { CVEMonitor } from '@/components/threats/CVEMonitor';
import { AttackSurface } from '@/components/threats/AttackSurface';
import { MitreMatrix } from '@/components/threats/MitreMatrix';
import { ThreatActorCards } from '@/components/threats/ThreatActorCards';
import clsx from 'clsx';

const tabs = [
  { id: 'iocs', label: 'IOC Feed' },
  { id: 'cves', label: 'CVE Monitor' },
  { id: 'surface', label: 'Attack Surface' },
  { id: 'mitre', label: 'MITRE ATT&CK' },
  { id: 'actors', label: 'Threat Actors' },
] as const;

type TabId = typeof tabs[number]['id'];

const ThreatsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('iocs');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Threat Intelligence</h1>
        <p className="text-base text-gray-400 mt-1">Monitor threats, IOCs, and attack surfaces</p>
      </div>

      {/* Tab bar */}
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

      {/* Tab content */}
      {activeTab === 'iocs' && <IOCFeedView />}
      {activeTab === 'cves' && <CVEMonitor />}
      {activeTab === 'surface' && <AttackSurface />}
      {activeTab === 'mitre' && <MitreMatrix />}
      {activeTab === 'actors' && <ThreatActorCards />}
    </div>
  );
};

export default ThreatsPage;
