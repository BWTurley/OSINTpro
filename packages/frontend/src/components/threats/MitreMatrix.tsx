import React, { useState } from 'react';
import { MITRE_TACTICS } from '@/utils/constants';
import clsx from 'clsx';

interface Technique {
  id: string;
  name: string;
  tactic: string;
  count: number;
}

// Demo techniques -- in production these come from the API
const demoTechniques: Technique[] = [
  { id: 'T1566', name: 'Phishing', tactic: 'Initial Access', count: 42 },
  { id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'Execution', count: 38 },
  { id: 'T1053', name: 'Scheduled Task/Job', tactic: 'Persistence', count: 25 },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Privilege Escalation', count: 19 },
  { id: 'T1027', name: 'Obfuscated Files', tactic: 'Defense Evasion', count: 31 },
  { id: 'T1003', name: 'OS Credential Dumping', tactic: 'Credential Access', count: 15 },
  { id: 'T1082', name: 'System Information Discovery', tactic: 'Discovery', count: 28 },
  { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement', count: 12 },
  { id: 'T1005', name: 'Data from Local System', tactic: 'Collection', count: 20 },
  { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control', count: 35 },
  { id: 'T1041', name: 'Exfiltration Over C2', tactic: 'Exfiltration', count: 8 },
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact', count: 6 },
  { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance', count: 22 },
  { id: 'T1583', name: 'Acquire Infrastructure', tactic: 'Resource Development', count: 14 },
  { id: 'T1190', name: 'Exploit Public-Facing App', tactic: 'Initial Access', count: 33 },
  { id: 'T1047', name: 'WMI', tactic: 'Execution', count: 18 },
  { id: 'T1547', name: 'Boot/Logon Autostart', tactic: 'Persistence', count: 21 },
  { id: 'T1055', name: 'Process Injection', tactic: 'Defense Evasion', count: 27 },
  { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', count: 16 },
  { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery', count: 13 },
];

function heatColor(count: number, maxCount: number): string {
  if (count === 0) return 'bg-surface-800';
  const intensity = count / maxCount;
  if (intensity > 0.75) return 'bg-red-600/60';
  if (intensity > 0.5) return 'bg-orange-500/50';
  if (intensity > 0.25) return 'bg-amber-500/40';
  return 'bg-yellow-500/25';
}

export const MitreMatrix: React.FC = () => {
  const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null);
  const maxCount = Math.max(...demoTechniques.map((t) => t.count), 1);

  const techniquesByTactic = MITRE_TACTICS.reduce<Record<string, Technique[]>>((acc, tactic) => {
    acc[tactic] = demoTechniques.filter((t) => t.tactic === tactic);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">MITRE ATT&CK Matrix</h3>
          <p className="text-base text-gray-400 mt-1">Technique observations mapped to tactics</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-4 rounded bg-yellow-500/25" />
            <div className="w-6 h-4 rounded bg-amber-500/40" />
            <div className="w-6 h-4 rounded bg-orange-500/50" />
            <div className="w-6 h-4 rounded bg-red-600/60" />
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex gap-2 min-w-max">
          {MITRE_TACTICS.map((tactic) => (
            <div key={tactic} className="w-44 flex-shrink-0">
              {/* Tactic header */}
              <div className="px-3 py-2.5 rounded-t-lg bg-surface-800 border border-gray-700/50 border-b-0">
                <p className="text-sm font-semibold text-gray-300 text-center">{tactic}</p>
              </div>
              {/* Techniques column */}
              <div className="border border-gray-700/50 rounded-b-lg overflow-hidden space-y-px bg-surface-900">
                {techniquesByTactic[tactic]?.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-600">No observations</div>
                ) : (
                  techniquesByTactic[tactic]?.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() => setSelectedTechnique(tech)}
                      className={clsx(
                        'w-full px-3 py-2.5 text-left transition-all hover:brightness-125',
                        heatColor(tech.count, maxCount),
                        selectedTechnique?.id === tech.id && 'ring-2 ring-blue-500 ring-inset'
                      )}
                    >
                      <p className="text-xs font-mono text-gray-400">{tech.id}</p>
                      <p className="text-sm text-gray-200 leading-tight">{tech.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tech.count} obs.</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected technique detail */}
      {selectedTechnique && (
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-mono text-blue-400">{selectedTechnique.id}</p>
              <h4 className="text-lg font-semibold text-gray-100">{selectedTechnique.name}</h4>
              <p className="text-base text-gray-400 mt-1">Tactic: {selectedTechnique.tactic}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-100">{selectedTechnique.count}</p>
              <p className="text-sm text-gray-500">observations</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
