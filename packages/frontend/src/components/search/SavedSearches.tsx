import React from 'react';
import { Search, Bell, BellOff, Trash2, Play } from 'lucide-react';
import { formatRelativeTime } from '@/utils/formatters';
import type { SavedSearch } from '@/types';

// Demo data
const demoSaved: SavedSearch[] = [
  { id: '1', name: 'Suspicious IPs', query: 'type:ip AND confidence:>70 AND tag:suspicious', filters: {}, alertEnabled: true, createdAt: '2026-04-01T10:00:00Z' },
  { id: '2', name: 'New Domains', query: 'type:domain AND firstSeen:>now-7d', filters: {}, alertEnabled: false, createdAt: '2026-03-28T14:00:00Z' },
  { id: '3', name: 'Malware Hashes', query: 'type:hash AND tag:malware', filters: {}, alertEnabled: true, createdAt: '2026-03-25T08:00:00Z' },
];

interface SavedSearchesProps {
  onRun: (search: SavedSearch) => void;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({ onRun }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-200">Saved Searches</h3>

      {demoSaved.length === 0 ? (
        <p className="text-base text-gray-500 py-4">No saved searches</p>
      ) : (
        <div className="space-y-2">
          {demoSaved.map((saved) => (
            <div
              key={saved.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-800/50 border border-gray-700/30 hover:bg-surface-800 transition-colors"
            >
              <Search className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-200">{saved.name}</p>
                <p className="text-sm text-gray-500 font-mono truncate">{saved.query}</p>
              </div>

              <span className="text-xs text-gray-500 flex-shrink-0">
                {formatRelativeTime(saved.createdAt)}
              </span>

              <button
                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                title={saved.alertEnabled ? 'Disable alerts' : 'Enable alerts'}
              >
                {saved.alertEnabled ? (
                  <Bell className="h-4 w-4 text-blue-400" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={() => onRun(saved)}
                className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors"
                title="Run search"
              >
                <Play className="h-4 w-4" />
              </button>

              <button
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
