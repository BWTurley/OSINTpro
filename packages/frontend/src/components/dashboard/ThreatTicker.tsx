import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_THREAT_FEED } from '@/graphql/queries/search';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel, formatRelativeTime } from '@/utils/formatters';
import clsx from 'clsx';
import type { IOCEntry } from '@/types';

export const ThreatTicker: React.FC = () => {
  const { data } = useQuery(GET_THREAT_FEED, {
    variables: { limit: 20 },
    pollInterval: 30000,
  });

  const iocs = (data?.threatFeed as IOCEntry[]) ?? [];

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">Latest IOCs</h3>

      <div className="relative overflow-hidden h-64">
        {iocs.length === 0 ? (
          <p className="text-base text-gray-500 text-center py-8">No recent IOCs</p>
        ) : (
          <div className="space-y-2 overflow-y-auto h-full scrollbar-thin pr-1">
            {iocs.map((ioc) => (
              <div
                key={ioc.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-800/50
                           border border-gray-700/30 hover:bg-surface-800 transition-colors"
              >
                <span
                  className={clsx(
                    'flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium',
                    ENTITY_BG_CLASSES[ioc.type]
                  )}
                >
                  {entityTypeLabel(ioc.type)}
                </span>
                <span className="text-base text-gray-200 font-mono truncate flex-1">
                  {ioc.value}
                </span>
                <span className="flex-shrink-0 text-sm text-gray-500">
                  {formatRelativeTime(ioc.firstSeen)}
                </span>
                {ioc.threatScore >= 80 && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">
                    {ioc.threatScore}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
