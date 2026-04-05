import React, { useState } from 'react';
import { Grid, List } from 'lucide-react';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel, formatRelativeTime, confidenceColor } from '@/utils/formatters';
import { TLPBadge } from '@/components/common/TLPBadge';
import clsx from 'clsx';
import type { Entity, FacetBucket } from '@/types';

interface FacetedResultsProps {
  results: Entity[];
  total: number;
  facets: Record<string, FacetBucket[]>;
  onEntityClick: (entity: Entity) => void;
  onLoadMore?: () => void;
  loading?: boolean;
}

export const FacetedResults: React.FC<FacetedResultsProps> = ({
  results,
  total,
  facets,
  onEntityClick,
  onLoadMore,
  loading,
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  return (
    <div className="space-y-4">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-base text-gray-400">
          {total} results {results.length < total && `(showing ${results.length})`}
        </p>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg border border-gray-700/50 p-1">
          <button
            onClick={() => setViewMode('card')}
            className={clsx(
              'p-2 rounded-md transition-colors',
              viewMode === 'card' ? 'bg-surface-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
            )}
            aria-label="Card view"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={clsx(
              'p-2 rounded-md transition-colors',
              viewMode === 'table' ? 'bg-surface-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
            )}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Facets bar */}
      {Object.keys(facets).length > 0 && (
        <div className="flex flex-wrap gap-4">
          {Object.entries(facets).map(([facetName, buckets]) => (
            <div key={facetName} className="flex items-center gap-2">
              <span className="text-sm text-gray-500 capitalize">{facetName}:</span>
              <div className="flex gap-1">
                {buckets.slice(0, 5).map((bucket) => (
                  <span
                    key={bucket.key}
                    className="px-2 py-0.5 rounded text-xs bg-surface-800 text-gray-400 border border-gray-700/50"
                  >
                    {bucket.key} ({bucket.count})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((entity) => (
            <button
              key={entity.id}
              onClick={() => onEntityClick(entity)}
              className="card text-left hover:border-gray-600 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', ENTITY_BG_CLASSES[entity.type])}>
                  {entityTypeLabel(entity.type)}
                </span>
                <TLPBadge level={entity.tlp} />
              </div>
              <p className="text-base font-medium text-gray-100 font-mono break-all">{entity.value}</p>
              {entity.label && entity.label !== entity.value && (
                <p className="text-sm text-gray-500 mt-1">{entity.label}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className={clsx('text-sm font-medium', confidenceColor(entity.confidence))}>
                  {entity.confidence}% confidence
                </span>
                <span className="text-xs text-gray-500">{formatRelativeTime(entity.lastSeen)}</span>
              </div>
              {entity.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entity.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-surface-800 text-gray-400">
                      {tag}
                    </span>
                  ))}
                  {entity.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{entity.tags.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700/50">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-gray-700/50 bg-surface-800/50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Label</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Confidence</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">TLP</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {results.map((entity) => (
                <tr
                  key={entity.id}
                  onClick={() => onEntityClick(entity)}
                  className="border-b border-gray-700/30 hover:bg-surface-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', ENTITY_BG_CLASSES[entity.type])}>
                      {entityTypeLabel(entity.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-200">{entity.value}</td>
                  <td className="px-4 py-3 text-gray-400">{entity.label || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={confidenceColor(entity.confidence)}>{entity.confidence}%</span>
                  </td>
                  <td className="px-4 py-3"><TLPBadge level={entity.tlp} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatRelativeTime(entity.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {results.length < total && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2.5 text-base font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : `Load More (${total - results.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
};
