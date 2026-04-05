import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_ENTITY } from '@/graphql/queries/entities';
import { EntityTabs } from './EntityTabs';
import { ConfidenceBadge } from './ConfidenceBadge';
import { TLPBadge } from '@/components/common/TLPBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PersonDetail } from './types/PersonDetail';
import { OrgDetail } from './types/OrgDetail';
import { DomainDetail } from './types/DomainDetail';
import { IPDetail } from './types/IPDetail';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel, formatDateTime, formatRelativeTime } from '@/utils/formatters';
import { ExternalLink, Tag, Clock, Database } from 'lucide-react';
import clsx from 'clsx';
import type { Entity } from '@/types';

interface EntityDetailProps {
  entityId: string;
}

function TypeSpecificView({ entity }: { entity: Entity }) {
  switch (entity.type) {
    case 'person':
      return <PersonDetail entity={entity} />;
    case 'organization':
      return <OrgDetail entity={entity} />;
    case 'domain':
      return <DomainDetail entity={entity} />;
    case 'ip':
      return <IPDetail entity={entity} />;
    default:
      return (
        <div className="space-y-3">
          {Object.entries(entity.metadata).map(([key, value]) => (
            <div key={key} className="flex justify-between py-2 border-b border-gray-700/30">
              <span className="text-base text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="text-base text-gray-200">{String(value)}</span>
            </div>
          ))}
        </div>
      );
  }
}

export const EntityDetail: React.FC<EntityDetailProps> = ({ entityId }) => {
  const { data, loading, error } = useQuery(GET_ENTITY, { variables: { id: entityId } });
  const entity = data?.entity as Entity | undefined;

  if (loading) return <LoadingSpinner text="Loading entity..." />;
  if (error) return <p className="text-base text-red-400">Error: {error.message}</p>;
  if (!entity) return <p className="text-base text-gray-500">Entity not found</p>;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: <TypeSpecificView entity={entity} />,
    },
    {
      id: 'raw',
      label: 'Raw Data',
      content: (
        <pre className="p-4 rounded-lg bg-surface-800 text-sm text-gray-300 font-mono overflow-auto max-h-96">
          {JSON.stringify(entity.metadata, null, 2)}
        </pre>
      ),
    },
    {
      id: 'relationships',
      label: `Relationships (${entity.relationships?.length ?? 0})`,
      content: (
        <div className="space-y-2">
          {entity.relationships?.length === 0 ? (
            <p className="text-base text-gray-500 py-4">No relationships found</p>
          ) : (
            entity.relationships?.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-800/50
                           border border-gray-700/30"
              >
                <span className="text-base text-gray-300">{rel.sourceId}</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-sm font-medium">
                  {rel.label}
                </span>
                <span className="text-base text-gray-300">{rel.targetId}</span>
                <span className="ml-auto text-sm text-gray-500">{rel.confidence}%</span>
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      id: 'notes',
      label: `Notes (${entity.notes?.length ?? 0})`,
      content: (
        <div className="space-y-3">
          {entity.notes?.length === 0 ? (
            <p className="text-base text-gray-500 py-4">No notes yet</p>
          ) : (
            entity.notes?.map((note) => (
              <div key={note.id} className="p-4 rounded-lg bg-surface-800/50 border border-gray-700/30 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{note.author}</span>
                  <span>{formatRelativeTime(note.createdAt)}</span>
                  <TLPBadge level={note.tlp} />
                </div>
                <p className="text-base text-gray-200 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className={clsx('px-3 py-1 rounded-lg text-sm font-semibold', ENTITY_BG_CLASSES[entity.type])}>
              {entityTypeLabel(entity.type)}
            </span>
            <TLPBadge level={entity.tlp} />
          </div>
          <h2 className="text-2xl font-bold text-gray-100 font-mono break-all">{entity.value}</h2>
          {entity.label && entity.label !== entity.value && (
            <p className="text-lg text-gray-400">{entity.label}</p>
          )}
        </div>
        <ConfidenceBadge confidence={entity.confidence} admiraltyCode={entity.admiraltyCode} />
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          First seen: {formatDateTime(entity.firstSeen)}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Last seen: {formatDateTime(entity.lastSeen)}
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="h-4 w-4" />
          Sources: {entity.sources.join(', ')}
        </div>
      </div>

      {/* Tags */}
      {entity.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-4 w-4 text-gray-500" />
          {entity.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-sm bg-surface-800 text-gray-300 border border-gray-700">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <EntityTabs tabs={tabs} />
    </div>
  );
};
