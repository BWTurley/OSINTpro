import React, { useState, useEffect } from 'react';
import { Search, Download } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { formatDateTime } from '@/utils/formatters';
import type { ColumnDef } from '@tanstack/react-table';
import type { AuditLogEntry } from '@/types';

const actionColors: Record<string, string> = {
  'entity.create': 'text-green-400',
  'entity.update': 'text-blue-400',
  'entity.delete': 'text-red-400',
  'entity.merge': 'text-purple-400',
  'case.update': 'text-amber-400',
  'collection.trigger': 'text-cyan-400',
  'user.create': 'text-green-400',
  'report.generate': 'text-blue-400',
  'search.execute': 'text-gray-400',
};

const columns: ColumnDef<AuditLogEntry, unknown>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Timestamp',
    cell: ({ row }) => (
      <span className="text-sm text-gray-400 font-mono">{formatDateTime(row.original.timestamp)}</span>
    ),
  },
  {
    accessorKey: 'userName',
    header: 'User',
    cell: ({ row }) => (
      <span className="text-base text-gray-200">{row.original.userName}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <span className={`text-base font-mono ${actionColors[row.original.action] ?? 'text-gray-400'}`}>
        {row.original.action}
      </span>
    ),
  },
  {
    accessorKey: 'entityType',
    header: 'Entity Type',
    cell: ({ row }) => (
      <span className="text-base text-gray-400 capitalize">{row.original.entityType || '-'}</span>
    ),
  },
  {
    accessorKey: 'details',
    header: 'Details',
    cell: ({ row }) => (
      <span className="text-base text-gray-300 truncate max-w-xs block">{row.original.details}</span>
    ),
  },
];

export const AuditLogViewer: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    fetch('/api/audit/logs', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    })
      .then((res) => res.json())
      .then((data) => setLogs(Array.isArray(data) ? data : data.logs ?? []))
      .catch((err) => console.error('Failed to load audit logs:', err));
  }, []);

  const filteredLogs = logs.filter((log) =>
    searchQuery === '' ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit logs..."
            className="w-full pl-10 pr-4 py-2.5 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 text-base text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg border border-gray-700/50 transition-colors">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <DataTable
        data={filteredLogs}
        columns={columns}
        pageSize={25}
        emptyMessage="No audit log entries found"
      />
    </div>
  );
};
