import React, { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { BULK_IMPORT } from '@/graphql/mutations/collection';
import { detectEntityType } from '@/utils/validators';
import { ENTITY_BG_CLASSES } from '@/utils/constants';
import { entityTypeLabel } from '@/utils/formatters';
import clsx from 'clsx';
import type { EntityType } from '@/types';

interface DetectedItem {
  value: string;
  type: EntityType | null;
}

export const BulkImport: React.FC = () => {
  const [input, setInput] = useState('');
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: { value: string; message: string }[];
  } | null>(null);

  const [bulkImport, { loading }] = useMutation(BULK_IMPORT);

  const handleDetect = useCallback(() => {
    const lines = input
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const items: DetectedItem[] = lines.map((value) => ({
      value,
      type: detectEntityType(value),
    }));

    setDetected(items);
    setImportResult(null);
  }, [input]);

  const handleImport = async () => {
    const validItems = detected.filter((d) => d.type !== null);
    if (validItems.length === 0) return;

    const result = await bulkImport({
      variables: {
        input: {
          entities: validItems.map((item) => ({
            type: item.type,
            value: item.value,
          })),
        },
      },
    });

    if (result.data?.bulkImport) {
      setImportResult(result.data.bulkImport);
    }
  };

  const validCount = detected.filter((d) => d.type !== null).length;
  const unknownCount = detected.filter((d) => d.type === null).length;

  return (
    <div className="card space-y-5">
      <h3 className="text-lg font-semibold text-gray-100">Bulk Import</h3>
      <p className="text-base text-gray-400">
        Paste a list of indicators (IPs, domains, emails, hashes) -- one per line.
        Types will be auto-detected.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={"192.168.1.1\nexample.com\nuser@example.com\ne99a18c428cb38d5f260853678922e03\n..."}
        rows={8}
        className="w-full px-4 py-3 text-base font-mono bg-surface-800 border border-gray-700
                   rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                   focus:ring-blue-500 resize-y"
      />

      <div className="flex gap-3">
        <button
          onClick={handleDetect}
          disabled={!input.trim()}
          className="px-4 py-2.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-700
                     rounded-lg transition-colors disabled:opacity-50"
        >
          Detect Types
        </button>
        {detected.length > 0 && (
          <button
            onClick={handleImport}
            disabled={loading || validCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 text-base font-medium text-white
                       bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? 'Importing...' : `Import ${validCount} Items`}
          </button>
        )}
      </div>

      {/* Detection results */}
      {detected.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{validCount} detected</span>
            {unknownCount > 0 && (
              <span className="text-amber-400">{unknownCount} unknown</span>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
            {detected.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-800/50"
              >
                {item.type ? (
                  <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', ENTITY_BG_CLASSES[item.type])}>
                    {entityTypeLabel(item.type)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                    Unknown
                  </span>
                )}
                <span className="text-base text-gray-200 font-mono truncate">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="p-4 rounded-lg bg-surface-800 border border-gray-700/50 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span className="text-base font-medium text-gray-200">Import Complete</span>
          </div>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>Created: {importResult.created}</span>
            <span>Updated: {importResult.updated}</span>
            {importResult.errors.length > 0 && (
              <span className="text-red-400">Errors: {importResult.errors.length}</span>
            )}
          </div>
          {importResult.errors.length > 0 && (
            <div className="space-y-1 mt-2">
              {importResult.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="font-mono">{err.value}</span>: {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
