import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Skull, Globe, Target, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { GET_THREAT_FEED } from '@/graphql/queries/search';
import { formatDate } from '@/utils/formatters';
import clsx from 'clsx';
import type { ThreatActor } from '@/types';

const sophColors: Record<string, string> = {
  Expert: 'bg-red-500/20 text-red-400',
  Advanced: 'bg-orange-500/20 text-orange-400',
  Intermediate: 'bg-yellow-500/20 text-yellow-400',
  Novice: 'bg-green-500/20 text-green-400',
};

export const ThreatActorCards: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data } = useQuery(GET_THREAT_FEED, {
    variables: { limit: 20, types: ['THREAT_ACTOR'] },
  });

  const actors: ThreatActor[] = (data?.threatFeed ?? []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: item.value as string,
    aliases: (item.tags as string[]) ?? [],
    motivation: 'Unknown',
    sophistication: 'Unknown',
    country: 'Unknown',
    ttps: [],
    description: '',
    firstSeen: item.firstSeen as string,
    lastSeen: item.lastSeen as string,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-100">Threat Actors</h3>
        <p className="text-base text-gray-400 mt-1">Known threat actors and their TTPs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {actors.map((actor) => {
          const isExpanded = expandedId === actor.id;
          return (
            <div
              key={actor.id}
              className="card transition-all hover:border-gray-600"
            >
              {/* Card header */}
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-red-500/10">
                  <Skull className="h-6 w-6 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-gray-100">{actor.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Globe className="h-3.5 w-3.5" />
                      {actor.country}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Target className="h-3.5 w-3.5" />
                      {actor.motivation}
                    </div>
                    <span className={clsx('badge text-xs', sophColors[actor.sophistication] ?? 'bg-gray-500/20 text-gray-400')}>
                      {actor.sophistication}
                    </span>
                  </div>
                </div>
              </div>

              {/* Aliases */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {actor.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="px-2 py-0.5 rounded text-xs bg-surface-800 text-gray-400 border border-gray-700/50"
                  >
                    {alias}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="text-base text-gray-300 mt-3 leading-relaxed">{actor.description}</p>

              {/* TTPs toggle */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : actor.id)}
                className="flex items-center gap-2 mt-3 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {actor.ttps.length} TTPs
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {actor.ttps.map((ttp) => (
                      <span key={ttp} className="px-2.5 py-1 rounded text-sm font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {ttp}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      First seen: {formatDate(actor.firstSeen)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Last seen: {formatDate(actor.lastSeen)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
