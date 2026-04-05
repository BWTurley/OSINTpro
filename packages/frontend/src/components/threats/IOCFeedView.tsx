import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_THREAT_FEED } from '@/graphql/queries/search';
import { DataTable } from '@/components/common/DataTable';
import { TLPBadge } from '@/components/common/TLPBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';
import { ENTITY_BG_CLASSES, SEVERITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel, formatRelativeTime } from '@/utils/formatters';
import clsx from 'clsx';
import type { IOCEntry, EntityType } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';

const typeFilters: EntityType[] = ['ip', 'domain', 'hash', 'email', 'malware'];

const columns: ColumnDef<IOCEntry, unknown>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', ENTITY_BG_CLASSES[row.original.type])}>
        {entityTypeLabel(row.original.type)}
      </span>
    ),
  },
  {
    accessorKey: 'value',
    header: 'Indicator',
    cell: ({ row }) => (
      <span className="text-base font-mono text-gray-200">{row.original.value}</span>
    ),
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => (
      <span className="text-base text-gray-300">{row.original.source}</span>
    ),
  },
  {
    accessorKey: 'threatScore',
    header: 'Threat Score',
    cell: ({ row }) => {
      const score = row.original.threatScore;
      const color =
        score >= 80 ? 'text-red-400' :
        score >= 60 ? 'text-orange-400' :
        score >= 40 ? 'text-yellow-400' : 'text-green-400';
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full', color.replace('text-', 'bg-'))}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={clsx('text-sm font-medium', color)}>{score}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'confidence',
    header: 'Confidence',
    cell: ({ row }) => (
      <span className="text-sm text-gray-400">{row.original.confidence}%</span>
    ),
  },
  {
    accessorKey: 'firstSeen',
    header: 'First Seen',
    cell: ({ row }) => (
      <span className="text-sm text-gray-400">{formatRelativeTime(row.original.firstSeen)}</span>
    ),
  },
  {
    accessorKey: 'lastSeen',
    header: 'Last Seen',
    cell: ({ row }) => (
      <span className="text-sm text-gray-400">{formatRelativeTime(row.original.lastSeen)}</span>
    ),
  },
];

export const IOCFeedView: React.FC = () => {
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);

  const { data, loading } = useQuery(GET_THREAT_FEED, {
    variables: {
      limit: 100,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
    },
    pollInterval: 30000,
  });

  const iocs = (data?.threatFeed as IOCEntry[]) ?? [];

  const toggleType = (type: EntityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Filter by type:</span>
        <div className="flex gap-1.5">
          {typeFilters.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                selectedTypes.includes(type)
                  ? ENTITY_BG_CLASSES[type] + ' border-current'
                  : 'bg-surface-800 text-gray-400 border-gray-700/50 hover:text-gray-200'
              )}
            >
              {entityTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton lines={10} />
      ) : (
        <DataTable
          data={iocs}
          columns={columns}
          searchable
          pageSize={25}
          emptyMessage="No IOCs found"
        />
      )}
    </div>
  );
};
