import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { ENTITY_COLORS } from '@/utils/constants';
import { entityTypeLabel } from '@/utils/formatters';
import type { EntityType } from '@/types';

const entityTypes: EntityType[] = [
  'person', 'organization', 'domain', 'ip', 'email', 'phone',
  'hash', 'malware', 'vulnerability', 'threat_actor', 'location',
];

interface GraphFiltersProps {
  onSearch: (entityId: string) => void;
}

export const GraphFilters: React.FC<GraphFiltersProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledTypes, setEnabledTypes] = useState<Set<EntityType>>(new Set(entityTypes));
  const [minConfidence, setMinConfidence] = useState(0);
  const [depth, setDepth] = useState(2);

  const toggleType = (type: EntityType) => {
    const next = new Set(enabledTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setEnabledTypes(next);
  };

  return (
    <div className="w-72 flex-shrink-0 bg-surface-900 border border-gray-700/50 rounded-xl p-5 space-y-6 overflow-y-auto">
      {/* Entity search */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Root Entity
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                onSearch(searchQuery.trim());
              }
            }}
            placeholder="Entity ID or value..."
            className="w-full pl-9 pr-3 py-2.5 text-base bg-surface-800 border border-gray-700
                       rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => {
            if (searchQuery.trim()) onSearch(searchQuery.trim());
          }}
          className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     rounded-lg transition-colors"
        >
          Load Graph
        </button>
      </div>

      {/* Entity types */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Entity Types
        </label>
        <div className="space-y-1.5">
          {entityTypes.map((type) => (
            <label
              key={type}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface-800
                         cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={enabledTypes.has(type)}
                onChange={() => toggleType(type)}
                className="rounded border-gray-600 bg-surface-800 text-blue-600
                           focus:ring-blue-500 focus:ring-offset-0"
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: ENTITY_COLORS[type] }}
              />
              <span className="text-base text-gray-300">{entityTypeLabel(type)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Confidence slider */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Min Confidence: {minConfidence}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={minConfidence}
          onChange={(e) => setMinConfidence(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Depth slider */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Traversal Depth: {depth}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>1</span>
          <span>3</span>
          <span>5</span>
        </div>
      </div>
    </div>
  );
};
