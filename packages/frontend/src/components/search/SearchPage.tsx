import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { AdvancedFilters } from './AdvancedFilters';
import { FacetedResults } from './FacetedResults';
import { SavedSearches } from './SavedSearches';
import { EntityDetail } from '@/components/entities/EntityDetail';
import { Modal } from '@/components/common/Modal';
import type { EntityType, TLPLevel } from '@/types';

interface FiltersState {
  types: EntityType[];
  sources: string[];
  minConfidence: number;
  maxConfidence: number;
  tlp: TLPLevel[];
  tags: string[];
  dateFrom: string;
  dateTo: string;
}

const defaultFilters: FiltersState = {
  types: [], sources: [], minConfidence: 0, maxConfidence: 100,
  tlp: [], tags: [], dateFrom: '', dateTo: '',
};

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const { query, setQuery, results, total, facets, loading, search, loadMore } = useSearch();
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Run initial search from URL param
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      search(initialQuery);
    }
  }, [initialQuery, setQuery, search]);

  const handleSearch = () => {
    search(query, {
      types: filters.types.length > 0 ? filters.types : undefined,
      sources: filters.sources.length > 0 ? filters.sources : undefined,
      minConfidence: filters.minConfidence > 0 ? filters.minConfidence : undefined,
      maxConfidence: filters.maxConfidence < 100 ? filters.maxConfidence : undefined,
      tlp: filters.tlp.length > 0 ? filters.tlp : undefined,
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Search</h1>
        <p className="text-base text-gray-400 mt-1">Advanced entity search and discovery</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search entities, IOCs, indicators..."
            className="w-full pl-11 pr-4 py-3 text-base bg-surface-800 border border-gray-700
                       rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                       focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-base font-medium transition-colors ${
            showFilters
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
              : 'bg-surface-800 text-gray-400 border-gray-700 hover:text-gray-200'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        <button
          onClick={handleSearch}
          className="px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Filters sidebar */}
        {showFilters && (
          <AdvancedFilters
            filters={filters}
            onChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        )}

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Saved searches */}
          <SavedSearches
            onRun={(saved) => {
              setQuery(saved.query);
              search(saved.query);
            }}
          />

          {/* Results */}
          {(results.length > 0 || loading) && (
            <FacetedResults
              results={results}
              total={total}
              facets={facets}
              onEntityClick={(entity) => setSelectedEntityId(entity.id)}
              onLoadMore={loadMore}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* Entity detail modal */}
      <Modal
        isOpen={!!selectedEntityId}
        onClose={() => setSelectedEntityId(null)}
        title="Entity Detail"
        size="xl"
      >
        {selectedEntityId && <EntityDetail entityId={selectedEntityId} />}
      </Modal>
    </div>
  );
};
