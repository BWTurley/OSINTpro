import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_MODULE_STATUS } from '@/graphql/queries/collection';
import { CheckCircle, XCircle, Settings, Eye, EyeOff, Zap } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { entityTypeLabel } from '@/utils/formatters';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import clsx from 'clsx';
import type { IntelModule } from '@/types';

export const ModuleConfig: React.FC = () => {
  const { data, loading } = useQuery(GET_MODULE_STATUS);
  const modules = (data?.intelModules as IntelModule[]) ?? [];
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  if (loading) return <LoadingSpinner text="Loading modules..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base text-gray-400">{modules.length} intelligence modules configured</p>
      </div>

      <div className="space-y-3">
        {modules.map((mod) => (
          <div
            key={mod.id}
            className="card"
          >
            <div className="flex items-start gap-4">
              {/* Status indicator */}
              <div className="mt-0.5">
                {mod.enabled && mod.healthy ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : mod.enabled && !mod.healthy ? (
                  <XCircle className="h-6 w-6 text-red-400" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-gray-700 border-2 border-gray-600" />
                )}
              </div>

              {/* Module info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-semibold text-gray-100">{mod.name}</h4>
                  {!mod.enabled && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-base text-gray-400 mt-1">{mod.description}</p>

                {/* Supported entity types */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {mod.entityTypes.map((type) => (
                    <span
                      key={type}
                      className={clsx('px-2 py-0.5 rounded text-xs font-medium', ENTITY_BG_CLASSES[type])}
                    >
                      {entityTypeLabel(type)}
                    </span>
                  ))}
                </div>

                {/* API Key field */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type={showApiKey[mod.id] ? 'text' : 'password'}
                      placeholder="API Key"
                      defaultValue="****************************"
                      className="w-full px-4 py-2.5 pr-10 text-base bg-surface-800 border border-gray-700
                                 rounded-lg text-gray-100 font-mono focus:outline-none focus:ring-2
                                 focus:ring-blue-500"
                    />
                    <button
                      onClick={() =>
                        setShowApiKey((prev) => ({ ...prev, [mod.id]: !prev[mod.id] }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showApiKey[mod.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/30 transition-colors">
                    <Zap className="h-4 w-4" />
                    Test
                  </button>
                </div>

                {/* Rate limit bar */}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-sm text-gray-500 w-20">Rate limit:</span>
                  <div className="flex-1 max-w-xs h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        mod.rateLimitUsed / mod.rateLimitMax > 0.9
                          ? 'bg-red-500'
                          : mod.rateLimitUsed / mod.rateLimitMax > 0.7
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      )}
                      style={{
                        width: `${Math.min(100, (mod.rateLimitUsed / mod.rateLimitMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">
                    {mod.rateLimitUsed} / {mod.rateLimitMax}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  className={clsx(
                    'px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                    mod.enabled
                      ? 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                      : 'text-gray-400 bg-surface-800 border-gray-700 hover:bg-surface-700'
                  )}
                >
                  {mod.enabled ? 'Enabled' : 'Enable'}
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-surface-800 rounded-lg transition-colors">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
