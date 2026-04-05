import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_MODULE_STATUS } from '@/graphql/queries/collection';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/common/LoadingSpinner';
import type { IntelModule } from '@/types';

export const ApiHealthStatus: React.FC = () => {
  const { data, loading } = useQuery(GET_MODULE_STATUS, { pollInterval: 30000 });
  const modules = (data?.intelModules as IntelModule[]) ?? [];

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-100">API Health</h3>

      {loading ? (
        <Skeleton lines={5} />
      ) : modules.length === 0 ? (
        <p className="text-base text-gray-500 text-center py-4">No modules configured</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
          {modules.map((mod) => {
            const isDisabled = !mod.enabled;
            const isHealthy = mod.enabled && mod.healthy;
            const isUnhealthy = mod.enabled && !mod.healthy;

            return (
              <div
                key={mod.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-800/50
                           border border-gray-700/30"
              >
                {isHealthy && <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />}
                {isUnhealthy && <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />}
                {isDisabled && <AlertTriangle className="h-5 w-5 text-gray-500 flex-shrink-0" />}

                <span className="text-base text-gray-200 flex-1 truncate">{mod.name}</span>

                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: mod.rateLimitMax > 0
                          ? `${Math.min(100, (mod.rateLimitUsed / mod.rateLimitMax) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {mod.rateLimitUsed}/{mod.rateLimitMax}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
