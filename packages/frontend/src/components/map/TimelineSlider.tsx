import React, { useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineSliderProps {
  startDate: Date;
  endDate: Date;
  currentDate: Date;
  onChange: (date: Date) => void;
  playing?: boolean;
  onPlayToggle?: () => void;
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  startDate,
  endDate,
  currentDate,
  onChange,
  playing = false,
  onPlayToggle,
}) => {
  const totalMs = endDate.getTime() - startDate.getTime();
  const currentMs = currentDate.getTime() - startDate.getTime();
  const percentage = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pct = Number(e.target.value);
      const ms = (pct / 100) * totalMs;
      onChange(new Date(startDate.getTime() + ms));
    },
    [startDate, totalMs, onChange]
  );

  const stepBack = () => {
    const newTime = new Date(currentDate.getTime() - totalMs * 0.05);
    onChange(newTime < startDate ? startDate : newTime);
  };

  const stepForward = () => {
    const newTime = new Date(currentDate.getTime() + totalMs * 0.05);
    onChange(newTime > endDate ? endDate : newTime);
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-surface-900 border border-gray-700/50 rounded-lg">
      <span className="text-sm text-gray-500 w-36 flex-shrink-0">
        {format(startDate, 'MMM d, yyyy')}
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={stepBack}
          className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Step back"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={onPlayToggle}
          className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={stepForward}
          className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Step forward"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={percentage}
          onChange={handleSliderChange}
          className="w-full accent-blue-500"
        />
      </div>

      <span className="text-sm font-medium text-gray-300 w-40 text-center flex-shrink-0">
        {format(currentDate, 'MMM d, yyyy HH:mm')}
      </span>

      <span className="text-sm text-gray-500 w-36 text-right flex-shrink-0">
        {format(endDate, 'MMM d, yyyy')}
      </span>
    </div>
  );
};
