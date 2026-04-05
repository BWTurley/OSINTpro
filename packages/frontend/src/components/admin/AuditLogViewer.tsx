import React, { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { formatDateTime } from '@/utils/formatters';
import type { ColumnDef } from '@tanstack/react-table';
import type { AuditLogEntry } from '@/types';

// Demo data
const demoLogs: AuditLogEntry[] = [
  { id: '1', userId: 'u1', userName: 'Admin User', action: 'entity.create', entityType: 'ip', entityId: 'e1', details: 'Created entity 192.168.1.1', timestamp: '2026-04-05T08:15:00Z' },
  { id: '2', userId: 'u2', userName: 'Jane Analyst', action: 'case.update', entityType: 'case', entityId: 'c1', details: 'Updated case status to in_progress', timestamp: '2026-04-05T08:10:00Z' },
  { id: '3', userId: 'u1', userName: 'Admin User', action: 'collection.trigger', entityType: 'domain', entityId: 'e2', details: 'Triggered VirusTotal for example.com', timestamp: '2026-04-05T08:05:00Z' },
  { id: '4', userId: 'u2', userName: 'Jane Analyst', action: 'entity.update', entityType: 'person', entityId: 'e3', details: 'Updated confidence to 85%', timestamp: '2026-04-05T07:55:00Z' },
  { id: '5', userId: 'u1', userName: 'Admin User', action: 'user.create', entityType: 'user', entityId: 'u3', details: 'Created user john@example.com', timestamp: '2026-04-05T07:45:00Z' },
  { id: '6', userId: 'u2', userName: 'Jane Analyst', action: 'entity.merge', entityType: 'ip', entityId: 'e4', details: 'Merged 3 entities into e4', timestamp: '2026-04-05T07:30:00Z' },
  { id: '7', userId: 'u1', userName: 'Admin User', action: 'report.generate', entityType: 'report', entityId: 'r1', details: 'Generated Threat Assessment report', timestamp: '2026-04-05T07:20:00Z' },
  { id: '8', userId: 'u3', userName: 'John Viewer', action: 'search.execute', entityType: '', entityId: '', details: 'Searched for "apt29"', timestamp: '2026-04-05T07:15:00Z' },
];

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

  const filteredLogs = demoLogs.filter((log) =>
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
