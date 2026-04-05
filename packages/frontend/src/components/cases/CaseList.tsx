import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Plus } from 'lucide-react';
import { GET_CASES } from '@/graphql/queries/cases';
import { DataTable } from '@/components/common/DataTable';
import { TLPBadge } from '@/components/common/TLPBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CASE_STATUS_CLASSES, CASE_STATUS_LABELS, SEVERITY_BG_CLASSES } from '@/utils/constants';
import { formatRelativeTime } from '@/utils/formatters';
import { Modal } from '@/components/common/Modal';
import clsx from 'clsx';
import type { ColumnDef } from '@tanstack/react-table';
import type { Case, Severity, TLPLevel } from '@/types';

type CaseRow = Case & { entityCount?: number };

const columns: ColumnDef<CaseRow, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="text-base font-medium text-gray-100">{row.original.title}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={clsx('badge text-xs', CASE_STATUS_CLASSES[row.original.status])}>
        {CASE_STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => (
      <span className={clsx('badge text-xs capitalize', SEVERITY_BG_CLASSES[row.original.priority])}>
        {row.original.priority}
      </span>
    ),
  },
  {
    accessorKey: 'tlp',
    header: 'TLP',
    cell: ({ row }) => <TLPBadge level={row.original.tlp} />,
  },
  {
    accessorKey: 'assignee',
    header: 'Assignee',
    cell: ({ row }) => (
      <span className="text-base text-gray-300">{row.original.assignee || '-'}</span>
    ),
  },
  {
    accessorKey: 'entityCount',
    header: 'Entities',
    cell: ({ row }) => (
      <span className="text-base text-gray-400">{row.original.entityCount ?? 0}</span>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Last Updated',
    cell: ({ row }) => (
      <span className="text-sm text-gray-500">{formatRelativeTime(row.original.updatedAt)}</span>
    ),
  },
];

export const CaseList: React.FC = () => {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTlp, setNewTlp] = useState<TLPLevel>('green');
  const [newPriority, setNewPriority] = useState<Severity>('medium');

  const { data, loading } = useQuery(GET_CASES, {
    variables: { limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' },
  });

  const cases = (data?.cases?.items as CaseRow[]) ?? [];

  if (loading) return <LoadingSpinner text="Loading cases..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base text-gray-400">{data?.cases?.total ?? 0} total cases</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Case
        </button>
      </div>

      <DataTable
        data={cases}
        columns={columns}
        searchable
        onRowClick={(row) => navigate(`/cases/${row.id}`)}
        emptyMessage="No cases found. Create your first case to get started."
      />

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Case" size="md">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-base font-medium text-gray-300">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Investigation title..."
              className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-base font-medium text-gray-300">TLP Level</label>
              <select
                value={newTlp}
                onChange={(e) => setNewTlp(e.target.value as TLPLevel)}
                className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="white">TLP:WHITE</option>
                <option value="green">TLP:GREEN</option>
                <option value="amber">TLP:AMBER</option>
                <option value="amber-strict">TLP:AMBER+STRICT</option>
                <option value="red">TLP:RED</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-base font-medium text-gray-300">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Severity)}
                className="w-full px-4 py-3 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-base text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!newTitle.trim()}
              className="px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Create Case
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
