import React, { useState } from 'react';
import { Globe, Server, Shield, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface AssetNode {
  id: string;
  label: string;
  type: 'domain' | 'subdomain' | 'ip' | 'service';
  status: 'secure' | 'exposed' | 'vulnerable';
  children?: AssetNode[];
  details?: string;
}

// Mock attack surface data
const mockAssets: AssetNode[] = [
  {
    id: '1', label: 'example.com', type: 'domain', status: 'exposed',
    children: [
      {
        id: '1-1', label: 'www.example.com', type: 'subdomain', status: 'secure',
        children: [
          { id: '1-1-1', label: '203.0.113.10', type: 'ip', status: 'secure', children: [
            { id: '1-1-1-1', label: 'HTTPS (443)', type: 'service', status: 'secure', details: 'TLS 1.3, valid cert' },
            { id: '1-1-1-2', label: 'HTTP (80)', type: 'service', status: 'exposed', details: 'Redirect to HTTPS' },
          ]},
        ],
      },
      {
        id: '1-2', label: 'api.example.com', type: 'subdomain', status: 'vulnerable',
        children: [
          { id: '1-2-1', label: '203.0.113.20', type: 'ip', status: 'vulnerable', children: [
            { id: '1-2-1-1', label: 'HTTPS (443)', type: 'service', status: 'vulnerable', details: 'TLS 1.1, CVE-2026-1234' },
            { id: '1-2-1-2', label: 'SSH (22)', type: 'service', status: 'exposed', details: 'OpenSSH 8.2' },
          ]},
        ],
      },
      {
        id: '1-3', label: 'mail.example.com', type: 'subdomain', status: 'secure',
        children: [
          { id: '1-3-1', label: '203.0.113.30', type: 'ip', status: 'secure', children: [
            { id: '1-3-1-1', label: 'SMTP (25)', type: 'service', status: 'secure', details: 'STARTTLS enabled' },
            { id: '1-3-1-2', label: 'IMAP (993)', type: 'service', status: 'secure', details: 'TLS 1.3' },
          ]},
        ],
      },
    ],
  },
];

const statusColors = {
  secure: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: Shield },
  exposed: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
  vulnerable: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: AlertTriangle },
};

const typeIcons = {
  domain: Globe,
  subdomain: Globe,
  ip: Server,
  service: Shield,
};

interface AssetTreeNodeProps {
  node: AssetNode;
  depth: number;
}

const AssetTreeNode: React.FC<AssetTreeNodeProps> = ({ node, depth }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const colors = statusColors[node.status];
  const Icon = typeIcons[node.type];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={clsx(depth > 0 && 'ml-6 border-l border-gray-700/30 pl-4')}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={clsx(
          'flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors',
          colors.bg, colors.border, 'border',
          hasChildren ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
        )}
      >
        <Icon className={clsx('h-4 w-4 flex-shrink-0', colors.text)} />
        <span className="text-base font-medium text-gray-200 flex-1">{node.label}</span>
        <span className={clsx('text-xs font-medium capitalize px-2 py-0.5 rounded', colors.text, colors.bg)}>
          {node.status}
        </span>
        {node.details && (
          <span className="text-xs text-gray-500">{node.details}</span>
        )}
        {hasChildren && (
          <span className="text-xs text-gray-500">{expanded ? '-' : '+'}</span>
        )}
      </button>

      {expanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {node.children!.map((child) => (
            <AssetTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const AttackSurface: React.FC = () => {
  // Count assets by status
  const countByStatus = (nodes: AssetNode[]): Record<string, number> => {
    const counts: Record<string, number> = { secure: 0, exposed: 0, vulnerable: 0 };
    const walk = (list: AssetNode[]) => {
      for (const node of list) {
        counts[node.status] = (counts[node.status] ?? 0) + 1;
        if (node.children) walk(node.children);
      }
    };
    walk(nodes);
    return counts;
  };

  const counts = countByStatus(mockAssets);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['secure', 'exposed', 'vulnerable'] as const).map((status) => {
          const colors = statusColors[status];
          const StatusIcon = colors.icon;
          return (
            <div
              key={status}
              className={clsx(
                'flex items-center gap-4 p-5 rounded-xl border',
                colors.bg, colors.border
              )}
            >
              <StatusIcon className={clsx('h-8 w-8', colors.text)} />
              <div>
                <p className={clsx('text-2xl font-bold', colors.text)}>{counts[status]}</p>
                <p className="text-sm text-gray-400 capitalize">{status} assets</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Asset tree */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-gray-200">Asset Discovery Tree</h3>
        <div className="space-y-2">
          {mockAssets.map((root) => (
            <AssetTreeNode key={root.id} node={root} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
};
