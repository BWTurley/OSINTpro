import React from 'react';
import { ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface TimelineControlsProps {
  groupBy: 'entity' | 'type' | 'source';
  onGroupByChange: (groupBy: 'entity' | 'type' | 'source') => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onPanLeft?: () => void;
  onPanRight?: () => void;
}

const groupOptions = [
  { id: 'entity' as const, label: 'Entity' },
  { id: 'type' as const, label: 'Event Type' },
  { id: 'source' as const, label: 'Source' },
];

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  groupBy,
  onGroupByChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onPanLeft,
  onPanRight,
}) => {
  return (
    <div className="flex items-center gap-4">
      {/* Group by selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Group by:</span>
        <div className="flex bg-surface-800 rounded-lg border border-gray-700/50 p-1">
          {groupOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onGroupByChange(opt.id)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                groupBy === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-lg border border-gray-700/50 p-1">
        <button
          onClick={onPanLeft}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Pan left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={onFit}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Fit all"
        >
          <Maximize className="h-4 w-4" />
        </button>
        <button
          onClick={onPanRight}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-surface-700 transition-colors"
          aria-label="Pan right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
