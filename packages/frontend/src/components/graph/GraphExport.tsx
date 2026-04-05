import React, { useState } from 'react';
import { Download, Image, FileJson } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import clsx from 'clsx';

interface GraphExportProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'png' | 'svg' | 'json') => void;
}

const formats = [
  { id: 'png' as const, label: 'PNG Image', icon: Image, desc: 'Raster image for presentations' },
  { id: 'svg' as const, label: 'SVG Vector', icon: Image, desc: 'Scalable vector for reports' },
  { id: 'json' as const, label: 'JSON Data', icon: FileJson, desc: 'Graph data for processing' },
];

export const GraphExport: React.FC<GraphExportProps> = ({ isOpen, onClose, onExport }) => {
  const [selected, setSelected] = useState<'png' | 'svg' | 'json'>('png');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Graph" size="sm">
      <div className="space-y-5">
        <div className="space-y-2">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setSelected(fmt.id)}
              className={clsx(
                'flex items-center gap-4 w-full p-4 rounded-lg border transition-colors text-left',
                selected === fmt.id
                  ? 'bg-blue-600/10 border-blue-500/50'
                  : 'bg-surface-800 border-gray-700/50 hover:bg-surface-700'
              )}
            >
              <fmt.icon className="h-6 w-6 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-base font-medium text-gray-200">{fmt.label}</p>
                <p className="text-sm text-gray-500">{fmt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-base text-gray-300 bg-surface-800 hover:bg-surface-700
                       rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onExport(selected);
              onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 text-base font-medium text-white
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
