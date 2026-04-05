import React, { useState } from 'react';
import { Download, FileText, FileJson, FileSpreadsheet, FileCode } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import clsx from 'clsx';

interface CaseExportProps {
  isOpen: boolean;
  onClose: () => void;
  caseTitle: string;
}

type ExportFormat = 'pdf' | 'stix' | 'csv' | 'json' | 'markdown';

interface FormatOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const formatOptions: FormatOption[] = [
  { id: 'pdf', label: 'PDF Report', description: 'Formatted investigation report', icon: FileText },
  { id: 'stix', label: 'STIX 2.1 Bundle', description: 'Structured threat intelligence exchange', icon: FileCode },
  { id: 'csv', label: 'CSV Export', description: 'Spreadsheet-compatible entity list', icon: FileSpreadsheet },
  { id: 'json', label: 'JSON Data', description: 'Complete case data as JSON', icon: FileJson },
  { id: 'markdown', label: 'Markdown', description: 'Markdown document for sharing', icon: FileText },
];

interface SectionOption {
  id: string;
  label: string;
  default: boolean;
}

const sectionOptions: SectionOption[] = [
  { id: 'summary', label: 'Executive Summary', default: true },
  { id: 'entities', label: 'Entity Details', default: true },
  { id: 'relationships', label: 'Relationship Map', default: true },
  { id: 'timeline', label: 'Event Timeline', default: true },
  { id: 'notes', label: 'Analyst Notes', default: false },
  { id: 'iocs', label: 'IOC List', default: true },
  { id: 'raw', label: 'Raw Data', default: false },
];

export const CaseExport: React.FC<CaseExportProps> = ({ isOpen, onClose, caseTitle }) => {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [sections, setSections] = useState<Set<string>>(
    new Set(sectionOptions.filter((s) => s.default).map((s) => s.id))
  );

  const toggleSection = (sectionId: string) => {
    const next = new Set(sections);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    setSections(next);
  };

  const handleExport = () => {
    // TODO: Trigger actual export
    console.log('Exporting case', caseTitle, { format, sections: Array.from(sections) });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Case" size="lg">
      <div className="space-y-6">
        <p className="text-base text-gray-400">
          Export <span className="font-medium text-gray-200">{caseTitle}</span>
        </p>

        {/* Format selection */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Format</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {formatOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFormat(opt.id)}
                className={clsx(
                  'flex items-center gap-3 p-4 rounded-lg border text-left transition-colors',
                  format === opt.id
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-surface-800 border-gray-700/50 hover:bg-surface-700'
                )}
              >
                <opt.icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-medium text-gray-200">{opt.label}</p>
                  <p className="text-xs text-gray-500 truncate">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section selection */}
        {(format === 'pdf' || format === 'markdown') && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Include Sections
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {sectionOptions.map((section) => (
                <label
                  key={section.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800
                             cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={sections.has(section.id)}
                    onChange={() => toggleSection(section.id)}
                    className="rounded border-gray-600 bg-surface-800 text-blue-600
                               focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-base text-gray-300">{section.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-base text-gray-300 bg-surface-800 hover:bg-surface-700
                       rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 text-base font-medium text-white
                       bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>
    </Modal>
  );
};
