import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Printer, Download, FileText } from 'lucide-react';
import { TLPBadge } from '@/components/common/TLPBadge';
import type { TLPLevel } from '@/types';

interface ReportSection {
  title: string;
  content: string;
}

interface ReportPreviewProps {
  title: string;
  templateName: string;
  tlp: TLPLevel;
  sections: ReportSection[];
  onExport: (format: 'pdf' | 'markdown' | 'docx') => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  title,
  templateName,
  tlp,
  sections,
  onExport,
}) => {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-200">Preview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg border border-gray-700/50 transition-colors"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            onClick={() => onExport('markdown')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg border border-gray-700/50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Markdown
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 bg-surface-800 hover:bg-surface-700 rounded-lg border border-gray-700/50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Report preview */}
      <div className="bg-surface-800 rounded-xl border border-gray-700/50 overflow-hidden">
        {/* Report header */}
        <div className="px-8 py-6 border-b border-gray-700/50 bg-surface-850">
          <div className="flex items-center gap-3 mb-3">
            <TLPBadge level={tlp} size="md" />
            <span className="text-sm text-gray-500">{templateName}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">{title || 'Untitled Report'}</h1>
          <p className="text-sm text-gray-500 mt-2">
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Sections */}
        <div className="px-8 py-6 space-y-8">
          {sections.length === 0 ? (
            <p className="text-base text-gray-500 text-center py-8">
              Add sections and content to preview your report
            </p>
          ) : (
            sections.map((section, i) => (
              <div key={i}>
                <h2 className="text-xl font-semibold text-gray-100 mb-4 pb-2 border-b border-gray-700/50">
                  {i + 1}. {section.title}
                </h2>
                <div className="prose prose-invert max-w-none text-base text-gray-300 prose-headings:text-gray-100 prose-a:text-blue-400 prose-code:text-green-400">
                  {section.content ? (
                    <ReactMarkdown>{section.content}</ReactMarkdown>
                  ) : (
                    <p className="text-gray-500 italic">No content yet</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
