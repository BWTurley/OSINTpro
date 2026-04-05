import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Download, Filter, Image } from 'lucide-react';
import clsx from 'clsx';

interface GraphControlsProps {
  layout: string;
  onLayoutChange: (layout: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

const layouts = [
  { id: 'cose', label: 'Force' },
  { id: 'breadthfirst', label: 'Hierarchical' },
  { id: 'circle', label: 'Circular' },
  { id: 'grid', label: 'Grid' },
  { id: 'concentric', label: 'Concentric' },
];

export const GraphControls: React.FC<GraphControlsProps> = ({
  layout,
  onLayoutChange,
  showFilters,
  onToggleFilters,
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Layout selector */}
      <div className="flex items-center bg-surface-800 rounded-lg border border-gray-700/50 p-1">
        {layouts.map((l) => (
          <button
            key={l.id}
            onClick={() => onLayoutChange(l.id)}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              layout === l.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-lg border border-gray-700/50 p-1">
        <button
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Fit to screen"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      {/* Export */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-lg border border-gray-700/50 p-1">
        <button
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Export PNG"
        >
          <Image className="h-4 w-4" />
        </button>
        <button
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Export data"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Filter toggle */}
      <button
        onClick={onToggleFilters}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
          showFilters
            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
            : 'bg-surface-800 text-gray-400 border-gray-700/50 hover:text-gray-200'
        )}
      >
        <Filter className="h-4 w-4" />
        Filters
      </button>
    </div>
  );
};
