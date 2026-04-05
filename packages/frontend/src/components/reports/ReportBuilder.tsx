import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_CASES } from '@/graphql/queries/cases';
import { FileText, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { ReportTemplates } from './ReportTemplates';
import { ReportPreview } from './ReportPreview';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { TLPBadge } from '@/components/common/TLPBadge';
import { Skeleton } from '@/components/common/LoadingSpinner';
import { CASE_STATUS_LABELS } from '@/utils/constants';
import clsx from 'clsx';
import type { Case, ReportTemplate, TLPLevel } from '@/types';

type BuilderStep = 'template' | 'configure' | 'preview';

interface ReportSection {
  id: string;
  title: string;
  content: string;
}

let sectionCounter = 0;

export const ReportBuilder: React.FC = () => {
  const [step, setStep] = useState<BuilderStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [tlp, setTlp] = useState<TLPLevel>('amber');
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const { data: casesData, loading: casesLoading } = useQuery(GET_CASES, {
    variables: { limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' },
  });
  const cases = (casesData?.cases?.items as (Case & { entityCount?: number })[]) ?? [];

  const steps: { id: BuilderStep; label: string }[] = [
    { id: 'template', label: 'Select Template' },
    { id: 'configure', label: 'Configure' },
    { id: 'preview', label: 'Preview & Export' },
  ];

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setSections(
      template.sections.map((s) => ({
        id: `section-${++sectionCounter}`,
        title: s,
        content: '',
      }))
    );
    setStep('configure');
  };

  const addSection = () => {
    const newSection: ReportSection = {
      id: `section-${++sectionCounter}`,
      title: 'New Section',
      content: '',
    };
    setSections((prev) => [...prev, newSection]);
    setActiveSection(newSection.id);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (activeSection === id) setActiveSection(null);
  };

  const updateSection = (id: string, updates: Partial<ReportSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <ChevronRight className="h-4 w-4 text-gray-600" />}
            <button
              onClick={() => {
                if (s.id === 'template' || selectedTemplate) setStep(s.id);
              }}
              className={clsx(
                'px-4 py-2 rounded-lg text-base font-medium transition-colors',
                step === s.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              {i + 1}. {s.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Template step */}
      {step === 'template' && (
        <ReportTemplates
          selectedId={selectedTemplate?.id ?? null}
          onSelect={handleTemplateSelect}
        />
      )}

      {/* Configure step */}
      {step === 'configure' && (
        <div className="flex gap-6">
          {/* Left sidebar: config */}
          <div className="w-80 flex-shrink-0 space-y-5">
            {/* Case selector */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Select Case</h3>
              {casesLoading ? (
                <Skeleton lines={3} />
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCaseId(c.id);
                        if (!title) setTitle(`${c.title} - Report`);
                      }}
                      className={clsx(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left border transition-colors',
                        caseId === c.id
                          ? 'bg-blue-600/10 border-blue-500/50'
                          : 'bg-surface-800/50 border-gray-700/30 hover:bg-surface-800'
                      )}
                    >
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{c.title}</p>
                        <p className="text-xs text-gray-500">{CASE_STATUS_LABELS[c.status]}</p>
                      </div>
                      <TLPBadge level={c.tlp} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & TLP */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Report Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Investigation Report"
                className="w-full px-4 py-2.5 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Classification</label>
              <select
                value={tlp}
                onChange={(e) => setTlp(e.target.value as TLPLevel)}
                className="w-full px-4 py-2.5 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="white">TLP:WHITE</option>
                <option value="green">TLP:GREEN</option>
                <option value="amber">TLP:AMBER</option>
                <option value="amber-strict">TLP:AMBER+STRICT</option>
                <option value="red">TLP:RED</option>
              </select>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Sections</h3>
              <div className="space-y-1.5">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                      activeSection === section.id
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'bg-surface-800 text-gray-300 border border-gray-700/50 hover:bg-surface-700'
                    )}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <GripVertical className="h-4 w-4 text-gray-600 flex-shrink-0" />
                    <span className="text-base flex-1 truncate">{section.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addSection}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-base text-gray-400 hover:text-gray-200 bg-surface-800 hover:bg-surface-700 rounded-lg border border-dashed border-gray-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            </div>

            <button
              onClick={() => setStep('preview')}
              disabled={!title.trim()}
              className="w-full py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-40 mt-4"
            >
              Preview Report
            </button>
          </div>

          {/* Right: editor */}
          <div className="flex-1 min-w-0">
            {activeSection ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={sections.find((s) => s.id === activeSection)?.title ?? ''}
                  onChange={(e) => updateSection(activeSection, { title: e.target.value })}
                  className="w-full px-4 py-3 text-lg font-semibold bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MarkdownEditor
                  value={sections.find((s) => s.id === activeSection)?.content ?? ''}
                  onChange={(content) => updateSection(activeSection, { content })}
                  minHeight="400px"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500 text-base border border-dashed border-gray-700 rounded-xl">
                Select a section to edit its content
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && (
        <ReportPreview
          title={title}
          templateName={selectedTemplate?.name ?? 'Custom'}
          tlp={tlp}
          sections={sections}
          onExport={(format) => {
            // TODO: Implement export
            console.log('Export as', format);
          }}
        />
      )}
    </div>
  );
};
