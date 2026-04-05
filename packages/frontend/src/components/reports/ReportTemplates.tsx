import React from 'react';
import { Shield, Search, AlertTriangle, FileCode } from 'lucide-react';
import clsx from 'clsx';
import type { ReportTemplate } from '@/types';

const templates: (ReportTemplate & { icon: React.FC<{ className?: string }>; color: string })[] = [
  {
    id: 'threat-assessment',
    name: 'Threat Assessment',
    description: 'Comprehensive threat analysis with IOCs, TTPs, and recommendations',
    sections: ['Executive Summary', 'Threat Actors', 'IOC Table', 'MITRE Mapping', 'Recommendations'],
    icon: Shield,
    color: 'text-red-400 bg-red-500/10 border-red-500/30',
  },
  {
    id: 'due-diligence',
    name: 'Due Diligence',
    description: 'Entity background check and risk assessment report',
    sections: ['Subject Overview', 'Corporate Structure', 'Adverse Media', 'Risk Assessment', 'Conclusion'],
    icon: Search,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'incident-report',
    name: 'Incident Report',
    description: 'Security incident documentation and response timeline',
    sections: ['Incident Summary', 'Timeline', 'Impact Analysis', 'Indicators', 'Remediation Steps'],
    icon: AlertTriangle,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'custom',
    name: 'Custom Report',
    description: 'Build your own report from scratch with custom sections',
    sections: ['Introduction'],
    icon: FileCode,
    color: 'text-gray-400 bg-surface-800 border-gray-700/50',
  },
];

interface ReportTemplatesProps {
  selectedId: string | null;
  onSelect: (template: ReportTemplate) => void;
}

export const ReportTemplates: React.FC<ReportTemplatesProps> = ({ selectedId, onSelect }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-200">Choose Template</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className={clsx(
              'flex items-start gap-4 p-5 rounded-xl border text-left transition-all',
              selectedId === tmpl.id
                ? 'ring-2 ring-blue-500 border-blue-500/50 bg-blue-500/5'
                : 'border-gray-700/50 bg-surface-900 hover:border-gray-600'
            )}
          >
            <div className={clsx('p-2.5 rounded-lg border', tmpl.color)}>
              <tmpl.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-100">{tmpl.name}</h4>
              <p className="text-base text-gray-400 mt-1">{tmpl.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tmpl.sections.map((section) => (
                  <span key={section} className="px-2 py-0.5 rounded text-xs bg-surface-800 text-gray-400 border border-gray-700/50">
                    {section}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
