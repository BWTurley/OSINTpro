import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel } from '@/utils/formatters';
import clsx from 'clsx';

export const QuickSearch: React.FC = () => {
  const navigate = useNavigate();
  const { query, setQuery, suggestions } = useSearch(200);

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">Quick Search</h3>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              navigate(`/search?q=${encodeURIComponent(query)}`);
            }
          }}
          placeholder="IP, domain, hash, email..."
          className="w-full pl-10 pr-4 py-3 text-base bg-surface-800 border border-gray-700
                     rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                     focus:ring-blue-500"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {suggestions.map((entity) => (
            <button
              key={entity.id}
              onClick={() => navigate(`/search?q=${encodeURIComponent(entity.value)}`)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left
                         hover:bg-surface-800 transition-colors"
            >
              <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', ENTITY_BG_CLASSES[entity.type])}>
                {entityTypeLabel(entity.type)}
              </span>
              <span className="text-base text-gray-200 truncate">{entity.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
