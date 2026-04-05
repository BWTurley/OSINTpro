import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Eye, Edit3 } from 'lucide-react';
import clsx from 'clsx';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your notes in Markdown...',
  minHeight = '200px',
  className,
  readOnly = false,
}) => {
  const [mode, setMode] = useState<'edit' | 'preview'>(readOnly ? 'preview' : 'edit');

  if (readOnly) {
    return (
      <div
        className={clsx(
          'prose prose-invert max-w-none text-base text-gray-200 p-4',
          'prose-headings:text-gray-100 prose-a:text-blue-400 prose-code:text-green-400',
          'prose-pre:bg-surface-800 prose-pre:border prose-pre:border-gray-700',
          className
        )}
      >
        <ReactMarkdown>{value || '*No content*'}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col border border-gray-700 rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-800 border-b border-gray-700">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            mode === 'edit'
              ? 'bg-surface-700 text-gray-100'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <Edit3 className="h-4 w-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            mode === 'preview'
              ? 'bg-surface-700 text-gray-100'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
      </div>

      {/* Content */}
      {mode === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 text-base text-gray-100 bg-surface-900 resize-y
                     placeholder-gray-500 focus:outline-none font-mono"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="px-4 py-3 bg-surface-900 prose prose-invert max-w-none text-base text-gray-200
                     prose-headings:text-gray-100 prose-a:text-blue-400 prose-code:text-green-400
                     prose-pre:bg-surface-800 prose-pre:border prose-pre:border-gray-700 overflow-auto"
          style={{ minHeight }}
        >
          <ReactMarkdown>{value || '*Nothing to preview*'}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};
