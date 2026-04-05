import { useState, useCallback, useRef, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client';
import { SEARCH } from '@/graphql/queries/search';
import type { Entity, EntityType, TLPLevel, SearchResult, FacetBucket } from '@/types';

interface SearchFilters {
  types?: EntityType[];
  sources?: string[];
  minConfidence?: number;
  maxConfidence?: number;
  tlp?: TLPLevel[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  filters: SearchFilters;
  setFilters: (f: SearchFilters) => void;
  results: Entity[];
  total: number;
  facets: Record<string, FacetBucket[]>;
  loading: boolean;
  error: string | null;
  search: (q?: string, f?: SearchFilters) => void;
  loadMore: () => void;
  suggestions: Entity[];
  suggestionsLoading: boolean;
}

export function useSearch(debounceMs = 300): UseSearchReturn {
  const [query, setQueryState] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, FacetBucket[]>>({});
  const [suggestions, setSuggestions] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const offsetRef = useRef(0);

  const [executeSearch, { loading }] = useLazyQuery(SEARCH, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      const result = data?.search as SearchResult | undefined;
      if (result) {
        if (offsetRef.current === 0) {
          setResults(result.entities);
        } else {
          setResults((prev) => [...prev, ...result.entities]);
        }
        setTotal(result.total);
        setFacets(result.facets);
      }
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const [executeSuggest, { loading: suggestionsLoading }] = useLazyQuery(SEARCH, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      const result = data?.search as SearchResult | undefined;
      if (result) {
        setSuggestions(result.entities);
      }
    },
  });

  const search = useCallback(
    (q?: string, f?: SearchFilters) => {
      const searchQuery = q ?? query;
      const searchFilters = f ?? filters;
      offsetRef.current = 0;
      executeSearch({
        variables: {
          query: searchQuery,
          ...searchFilters,
          limit: 25,
          offset: 0,
        },
      });
    },
    [query, filters, executeSearch]
  );

  const loadMore = useCallback(() => {
    offsetRef.current += 25;
    executeSearch({
      variables: {
        query,
        ...filters,
        limit: 25,
        offset: offsetRef.current,
      },
    });
  }, [query, filters, executeSearch]);

  // Debounced type-ahead
  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (q.length >= 2) {
        debounceRef.current = setTimeout(() => {
          executeSuggest({
            variables: { query: q, limit: 8, offset: 0 },
          });
        }, debounceMs);
      } else {
        setSuggestions([]);
      }
    },
    [debounceMs, executeSuggest]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    total,
    facets,
    loading,
    error,
    search,
    loadMore,
    suggestions,
    suggestionsLoading,
  };
}
