import React from 'react';
import { Pentagon, Ruler, Download } from 'lucide-react';
import clsx from 'clsx';

interface MapControlsProps {
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;
  onExport: () => void;
}

const tools = [
  { id: 'polygon', label: 'Draw Polygon', icon: Pentagon },
  { id: 'measure', label: 'Measure Distance', icon: Ruler },
];

export const MapControls: React.FC<MapControlsProps> = ({ activeTool, onToolChange, onExport }) => {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
          className={clsx(
            'p-2.5 rounded-lg shadow-lg border transition-colors',
            activeTool === tool.id
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-surface-800 text-gray-300 border-gray-700 hover:bg-surface-700'
          )}
          aria-label={tool.label}
          title={tool.label}
        >
          <tool.icon className="h-5 w-5" />
        </button>
      ))}
      <button
        onClick={onExport}
        className="p-2.5 rounded-lg shadow-lg border bg-surface-800 text-gray-300
                   border-gray-700 hover:bg-surface-700 transition-colors"
        aria-label="Export map as PNG"
        title="Export PNG"
      >
        <Download className="h-5 w-5" />
      </button>
    </div>
  );
};
