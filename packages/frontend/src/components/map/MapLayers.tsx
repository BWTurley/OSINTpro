import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import clsx from 'clsx';

interface LayerConfig {
  id: string;
  label: string;
  visible: boolean;
  opacity: number;
}

interface MapLayersProps {
  layers: LayerConfig[];
  onToggle: (layerId: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

export const MapLayers: React.FC<MapLayersProps> = ({ layers, onToggle, onOpacityChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-2.5 rounded-lg shadow-lg border transition-colors',
          isOpen
            ? 'bg-blue-600 text-white border-blue-500'
            : 'bg-surface-800 text-gray-300 border-gray-700 hover:bg-surface-700'
        )}
        aria-label="Toggle layers panel"
      >
        <Layers className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-surface-800 border border-gray-700
                        rounded-lg shadow-xl p-4 space-y-4">
          <h4 className="text-base font-semibold text-gray-200">Map Layers</h4>
          <div className="space-y-3">
            {layers.map((layer) => (
              <div key={layer.id} className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={() => onToggle(layer.id)}
                    className="rounded border-gray-600 bg-surface-700 text-blue-600
                               focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-base text-gray-300">{layer.label}</span>
                </label>
                {layer.visible && (
                  <div className="flex items-center gap-3 pl-8">
                    <span className="text-xs text-gray-500 w-14">Opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={layer.opacity * 100}
                      onChange={(e) =>
                        onOpacityChange(layer.id, Number(e.target.value) / 100)
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-xs text-gray-500 w-8">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
