import React, { useState } from 'react';
import { Save, Trash2, Database } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import clsx from 'clsx';

interface RetentionRule {
  id: string;
  name: string;
  description: string;
  entityTypes: string;
  maxAgeDays: number;
  minConfidence: number;
  sources: string;
  action: 'archive' | 'delete';
  enabled: boolean;
}

const defaultRules: RetentionRule[] = [
  {
    id: '1',
    name: 'Archive Old Low-Confidence',
    description: 'Archive entities older than 90 days with confidence below 30%',
    entityTypes: 'all',
    maxAgeDays: 90,
    minConfidence: 30,
    sources: 'all',
    action: 'archive',
    enabled: true,
  },
  {
    id: '2',
    name: 'Delete Stale IOCs',
    description: 'Delete IOCs older than 180 days from automated feeds',
    entityTypes: 'ip,domain,hash',
    maxAgeDays: 180,
    minConfidence: 0,
    sources: 'automated',
    action: 'delete',
    enabled: false,
  },
  {
    id: '3',
    name: 'Archive Resolved Cases',
    description: 'Archive closed cases older than 365 days',
    entityTypes: 'case',
    maxAgeDays: 365,
    minConfidence: 0,
    sources: 'all',
    action: 'archive',
    enabled: true,
  },
];

export const DataRetention: React.FC = () => {
  const [rules, setRules] = useState(defaultRules);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const updateRule = (id: string, field: string, value: string | number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Data Retention Policies</h3>
          <p className="text-base text-gray-400 mt-1">Configure automatic archiving and cleanup rules</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPurgeConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-base font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Run Cleanup Now
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className={clsx('card', !rule.enabled && 'opacity-60')}>
            <div className="flex items-start gap-4">
              {/* Toggle */}
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-700 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white" />
              </label>

              <div className="flex-1 space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-100">{rule.name}</h4>
                  <p className="text-base text-gray-400 mt-1">{rule.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-500">Max Age (days)</label>
                    <input
                      type="number"
                      value={rule.maxAgeDays}
                      onChange={(e) => updateRule(rule.id, 'maxAgeDays', Number(e.target.value))}
                      className="w-full px-3 py-2 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-500">Max Confidence (%)</label>
                    <input
                      type="number"
                      value={rule.minConfidence}
                      onChange={(e) => updateRule(rule.id, 'minConfidence', Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-500">Entity Types</label>
                    <input
                      type="text"
                      value={rule.entityTypes}
                      onChange={(e) => updateRule(rule.id, 'entityTypes', e.target.value)}
                      className="w-full px-3 py-2 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-500">Action</label>
                    <select
                      value={rule.action}
                      onChange={(e) => updateRule(rule.id, 'action', e.target.value)}
                      className="w-full px-3 py-2 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="archive">Archive</option>
                      <option value="delete">Delete</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action indicator */}
              <div className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
                rule.action === 'delete' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
              )}>
                {rule.action === 'delete' ? <Trash2 className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                {rule.action === 'delete' ? 'Delete' : 'Archive'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={showPurgeConfirm}
        onClose={() => setShowPurgeConfirm(false)}
        onConfirm={() => setShowPurgeConfirm(false)}
        title="Run Cleanup"
        message="This will execute all enabled retention rules immediately. Data matching the rules will be archived or deleted. This action cannot be undone."
        confirmLabel="Run Cleanup"
        variant="danger"
      />
    </div>
  );
};
