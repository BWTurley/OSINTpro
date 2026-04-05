import React, { useState } from 'react';
import { Clock, Play, Pause, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { formatDateTime } from '@/utils/formatters';
import clsx from 'clsx';
import type { ScheduledJob } from '@/types';

// Demo data
const demoScheduled: ScheduledJob[] = [
  {
    id: '1', name: 'Daily IOC Sweep', module: 'VirusTotal',
    cron: '0 6 * * *', enabled: true, lastRun: '2026-04-05T06:00:00Z',
    nextRun: '2026-04-06T06:00:00Z', entityQuery: 'type:ip AND confidence:>70',
  },
  {
    id: '2', name: 'Hourly Domain Monitor', module: 'PassiveTotal',
    cron: '0 * * * *', enabled: true, lastRun: '2026-04-05T07:00:00Z',
    nextRun: '2026-04-05T08:00:00Z', entityQuery: 'type:domain AND tag:monitored',
  },
  {
    id: '3', name: 'Weekly Threat Actor Update', module: 'MITRE',
    cron: '0 0 * * 1', enabled: false, lastRun: '2026-03-31T00:00:00Z',
    nextRun: '2026-04-07T00:00:00Z', entityQuery: 'type:threat_actor',
  },
];

export const ScheduledJobs: React.FC = () => {
  const [jobs, setJobs] = useState<ScheduledJob[]>(demoScheduled);
  const [showCreate, setShowCreate] = useState(false);

  const toggleJob = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base text-gray-400">{jobs.length} scheduled jobs</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Schedule
        </button>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="card">
            <div className="flex items-start gap-4">
              <div className={clsx('p-2.5 rounded-lg', job.enabled ? 'bg-blue-500/10' : 'bg-surface-800')}>
                <Clock className={clsx('h-5 w-5', job.enabled ? 'text-blue-400' : 'text-gray-500')} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-semibold text-gray-100">{job.name}</h4>
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-surface-800 text-gray-400 border border-gray-700">
                    {job.cron}
                  </span>
                  {!job.enabled && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Paused</span>
                  )}
                </div>
                <p className="text-base text-gray-400 mt-1">
                  Module: <span className="text-gray-300">{job.module}</span>
                </p>
                <p className="text-sm text-gray-500 font-mono mt-1">{job.entityQuery}</p>

                <div className="flex gap-6 mt-3 text-sm text-gray-500">
                  {job.lastRun && (
                    <span>Last run: {formatDateTime(job.lastRun)}</span>
                  )}
                  <span className={job.enabled ? 'text-blue-400' : ''}>
                    Next run: {formatDateTime(job.nextRun)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleJob(job.id)}
                  className={clsx(
                    'p-2 rounded-lg border transition-colors',
                    job.enabled
                      ? 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                      : 'text-gray-400 bg-surface-800 border-gray-700 hover:bg-surface-700'
                  )}
                  title={job.enabled ? 'Pause' : 'Resume'}
                >
                  {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Scheduled Job" size="md">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-300">Job Name</label>
            <input
              type="text"
              placeholder="e.g., Daily IOC Sweep"
              className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-base font-medium text-gray-300">Module</label>
              <select className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>VirusTotal</option>
                <option>PassiveTotal</option>
                <option>Shodan</option>
                <option>MITRE</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-base font-medium text-gray-300">CRON Expression</label>
              <input
                type="text"
                placeholder="0 6 * * *"
                className="w-full px-4 py-3 text-base font-mono bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-300">Entity Query</label>
            <input
              type="text"
              placeholder="type:ip AND confidence:>70"
              className="w-full px-4 py-3 text-base font-mono bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-base text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">Cancel</button>
            <button className="px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
