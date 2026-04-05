import React, { useState, useEffect } from 'react';
import { Search, Bell, BellOff, Trash2, Play } from 'lucide-react';
import { formatRelativeTime } from '@/utils/formatters';
import type { SavedSearch } from '@/types';

interface SavedSearchesProps {
  onRun: (search: SavedSearch) => void;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({ onRun }) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const loadSearches = () => {
    fetch('/api/search/saved', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    })
      .then((res) => res.json())
      .then((data) => setSavedSearches(Array.isArray(data) ? data : data.items ?? []))
      .catch((err) => console.error('Failed to load saved searches:', err));
  };

  useEffect(() => { loadSearches(); }, []);

  const handleToggleAlert = async (search: SavedSearch) => {
    try {
      await fetch(`/api/search/saved/${search.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alertEnabled: !search.alertEnabled }),
      });
      loadSearches();
    } catch (err) {
      console.error('Failed to toggle alert:', err);
    }
  };

  const handleDelete = async (searchId: string) => {
    try {
      await fetch(`/api/search/saved/${searchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      loadSearches();
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-200">Saved Searches</h3>

      {savedSearches.length === 0 ? (
        <p className="text-base text-gray-500 py-4">No saved searches</p>
      ) : (
        <div className="space-y-2">
          {savedSearches.map((saved) => (
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
                onClick={() => handleToggleAlert(saved)}
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
                onClick={() => handleDelete(saved.id)}
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
