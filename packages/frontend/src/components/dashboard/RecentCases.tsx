import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { FolderOpen } from 'lucide-react';
import { GET_CASES } from '@/graphql/queries/cases';
import { TLPBadge } from '@/components/common/TLPBadge';
import { formatRelativeTime } from '@/utils/formatters';
import { CASE_STATUS_CLASSES, CASE_STATUS_LABELS } from '@/utils/constants';
import { Skeleton } from '@/components/common/LoadingSpinner';
import clsx from 'clsx';
import type { Case } from '@/types';

export const RecentCases: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading } = useQuery(GET_CASES, {
    variables: { limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' },
  });

  const cases = (data?.cases?.items as Case[]) ?? [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Recent Cases</h3>
        <button
          onClick={() => navigate('/cases')}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View all
        </button>
      </div>

      {loading ? (
        <Skeleton lines={4} />
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-gray-500">
          <FolderOpen className="h-8 w-8" />
          <p className="text-base">No cases yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/cases/${c.id}`)}
              className="flex items-center gap-4 w-full px-4 py-3 rounded-lg text-left
                         hover:bg-surface-800 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-200 truncate">{c.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{formatRelativeTime(c.updatedAt)}</p>
              </div>
              <TLPBadge level={c.tlp} />
              <span className={clsx('badge text-xs', CASE_STATUS_CLASSES[c.status])}>
                {CASE_STATUS_LABELS[c.status]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
