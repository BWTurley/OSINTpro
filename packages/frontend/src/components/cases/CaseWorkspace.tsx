import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Download,
  Share2,
  MoreHorizontal,
} from 'lucide-react';
import { GET_CASE } from '@/graphql/queries/cases';
import { ADD_ENTITY_TO_CASE } from '@/graphql/mutations/cases';
import { TLPBadge } from '@/components/common/TLPBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CaseNotes } from './CaseNotes';
import { CaseExport } from './CaseExport';
import { CASE_STATUS_CLASSES, CASE_STATUS_LABELS, SEVERITY_BG_CLASSES, ENTITY_BG_CLASSES } from '@/utils/constants';
import { formatDate, entityTypeLabel } from '@/utils/formatters';
import clsx from 'clsx';
import type { Case, Entity } from '@/types';

interface CaseWorkspaceProps {
  caseId: string;
}

type WorkspaceTab = 'entities' | 'notes' | 'graph' | 'timeline';

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({ caseId }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('entities');
  const [showExport, setShowExport] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_CASE, {
    variables: { id: caseId },
  });

  const [addEntityToCase] = useMutation(ADD_ENTITY_TO_CASE);

  const caseData = data?.case_ as Case | undefined;

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading case..." className="mt-20" />;
  }

  if (error || !caseData) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-gray-500">
        <p className="text-lg">Case not found</p>
        <button
          onClick={() => navigate('/cases')}
          className="text-blue-400 hover:text-blue-300 text-base"
        >
          Back to cases
        </button>
      </div>
    );
  }

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'entities', label: `Entities (${caseData.entities?.length ?? 0})` },
    { id: 'notes', label: `Notes (${caseData.notes?.length ?? 0})` },
    { id: 'graph', label: 'Graph' },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/cases')}
            className="mt-1 p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-800 transition-colors"
            aria-label="Back to cases"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-100">{caseData.title}</h1>
              <TLPBadge level={caseData.tlp} size="md" />
              <span className={clsx('badge text-xs', CASE_STATUS_CLASSES[caseData.status])}>
                {CASE_STATUS_LABELS[caseData.status]}
              </span>
              <span className={clsx('badge text-xs capitalize', SEVERITY_BG_CLASSES[caseData.priority])}>
                {caseData.priority}
              </span>
            </div>
            {caseData.description && (
              <p className="text-base text-gray-400 mt-2 max-w-2xl">{caseData.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>Created {formatDate(caseData.createdAt)}</span>
              <span>Assigned to {caseData.assignee || 'Unassigned'}</span>
              {caseData.tags.length > 0 && (
                <div className="flex gap-1">
                  {caseData.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-xs bg-surface-800 text-gray-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const entityId = prompt('Enter entity ID to add:');
              if (entityId) {
                await addEntityToCase({ variables: { caseId, entityId } });
                refetch();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                       bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Entity
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300
                       bg-surface-800 hover:bg-surface-700 rounded-lg border border-gray-700/50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-surface-800 rounded-lg transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-3 text-base font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'entities' && (
        <EntityList entities={caseData.entities ?? []} />
      )}
      {activeTab === 'notes' && (
        <CaseNotes caseId={caseId} notes={caseData.notes ?? []} />
      )}
      {activeTab === 'graph' && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <p className="text-base">Graph view for case entities -- select the Graph page for the full explorer</p>
        </div>
      )}
      {activeTab === 'timeline' && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <p className="text-base">Timeline view for case events will render here</p>
        </div>
      )}

      {/* Export dialog */}
      <CaseExport
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        caseTitle={caseData.title}
        caseId={caseId}
      />
    </div>
  );
};

interface EntityListProps {
  entities: Entity[];
}

const EntityList: React.FC<EntityListProps> = ({ entities }) => {
  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-gray-500">
        <Share2 className="h-10 w-10" />
        <p className="text-base">No entities in this case yet</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {entities.map((entity) => (
        <div
          key={entity.id}
          className="flex items-center gap-4 px-5 py-4 rounded-lg bg-surface-800/50
                     border border-gray-700/30 hover:bg-surface-800 transition-colors cursor-pointer"
        >
          <span className={clsx('px-2.5 py-1 rounded text-xs font-medium', ENTITY_BG_CLASSES[entity.type])}>
            {entityTypeLabel(entity.type)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-gray-200 truncate">{entity.value}</p>
            {entity.label && entity.label !== entity.value && (
              <p className="text-sm text-gray-500 truncate">{entity.label}</p>
            )}
          </div>
          <span className="text-sm text-gray-400">{entity.confidence}%</span>
          <TLPBadge level={entity.tlp} />
        </div>
      ))}
    </div>
  );
};
