import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel, formatRelativeTime } from '@/utils/formatters';
import { ConfidenceBadge } from './ConfidenceBadge';
import clsx from 'clsx';
import type { Entity, EntityType } from '@/types';

const entityTypes: EntityType[] = [
  'person', 'organization', 'domain', 'ip', 'email', 'phone',
  'hash', 'malware', 'vulnerability', 'threat_actor',
];

interface EntitySearchProps {
  onSelect: (entity: Entity) => void;
}

export const EntitySearch: React.FC<EntitySearchProps> = ({ onSelect }) => {
  const { query, setQuery, results, total, loading, search } = useSearch(300);
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);

  const toggleType = (type: EntityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSearch = () => {
    search(query, { types: selectedTypes.length > 0 ? selectedTypes : undefined });
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search entities..."
            className="w-full pl-10 pr-4 py-3 text-base bg-surface-800 border border-gray-700
                       rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                       focus:ring-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700
                     rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {entityTypes.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              selectedTypes.includes(type)
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                : 'bg-surface-800 text-gray-400 border-gray-700/50 hover:text-gray-200'
            )}
          >
            {entityTypeLabel(type)}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-base text-gray-500 py-4">Searching...</p>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{total} results</p>
          {results.map((entity) => (
            <button
              key={entity.id}
              onClick={() => onSelect(entity)}
              className="flex items-center gap-4 w-full px-4 py-3 rounded-lg bg-surface-800/50
                         border border-gray-700/30 hover:bg-surface-800 transition-colors text-left"
            >
              <span className={clsx('px-2.5 py-1 rounded text-xs font-medium', ENTITY_BG_CLASSES[entity.type])}>
                {entityTypeLabel(entity.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-200 truncate">{entity.value}</p>
                {entity.label && entity.label !== entity.value && (
                  <p className="text-sm text-gray-500 truncate">{entity.label}</p>
                )}
              </div>
              <ConfidenceBadge confidence={entity.confidence} showLabel={false} />
              <span className="text-sm text-gray-500">{formatRelativeTime(entity.lastSeen)}</span>
            </button>
          ))}
        </div>
      ) : query.length > 0 ? (
        <p className="text-base text-gray-500 py-4 text-center">No results found</p>
      ) : null}
    </div>
  );
};
