import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_COLLECTION_JOBS } from '@/graphql/queries/collection';
import { useJobSubscription } from '@/hooks/useWebSocket';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatRelativeTime } from '@/utils/formatters';
import clsx from 'clsx';
import type { CollectionJob, JobStatus } from '@/types';

const statusConfig: Record<JobStatus, { icon: React.FC<{ className?: string }>; color: string; bg: string }> = {
  queued: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  cancelled: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

export const JobQueue: React.FC = () => {
  const { data, loading } = useQuery(GET_COLLECTION_JOBS, {
    variables: { limit: 50 },
    pollInterval: 5000,
  });

  // Subscribe to real-time updates
  useJobSubscription();

  const jobs = (data?.collectionJobs?.items as CollectionJob[]) ?? [];
  const counts = data?.collectionJobs?.counts as {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  } | undefined;

  if (loading) return <LoadingSpinner text="Loading job queue..." />;

  return (
    <div className="space-y-4">
      {/* Status counters */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Queued', count: counts?.queued ?? 0, color: 'text-gray-400', bg: 'bg-surface-800' },
          { label: 'Running', count: counts?.running ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Completed', count: counts?.completed ?? 0, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Failed', count: counts?.failed ?? 0, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((stat) => (
          <div key={stat.label} className={clsx('rounded-xl p-4 border border-gray-700/50', stat.bg)}>
            <p className={clsx('text-3xl font-bold', stat.color)}>{stat.count}</p>
            <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-base text-gray-500">No collection jobs</p>
          </div>
        ) : (
          jobs.map((job) => {
            const config = statusConfig[job.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={job.id}
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-surface-900 border border-gray-700/50"
              >
                <div className={clsx('p-2 rounded-lg', config.bg)}>
                  <StatusIcon
                    className={clsx(
                      'h-5 w-5',
                      config.color,
                      job.status === 'running' && 'animate-spin'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-gray-200">{job.module}</span>
                    <span className="text-sm text-gray-500">for</span>
                    <span className="text-base font-mono text-gray-300 truncate">{job.entityValue}</span>
                  </div>
                  {job.error && (
                    <p className="text-sm text-red-400 mt-1 truncate">{job.error}</p>
                  )}
                </div>

                {/* Progress */}
                {job.status === 'running' && (
                  <div className="flex items-center gap-2 w-32">
                    <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-10 text-right">{job.progress}%</span>
                  </div>
                )}

                {/* Results count */}
                {job.resultCount > 0 && (
                  <span className="px-2.5 py-1 rounded text-sm font-medium bg-green-500/10 text-green-400">
                    {job.resultCount} results
                  </span>
                )}

                {/* Timestamp */}
                <span className="text-sm text-gray-500 w-28 text-right flex-shrink-0">
                  {formatRelativeTime(job.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
