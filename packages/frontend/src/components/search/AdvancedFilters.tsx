import React from 'react';
import { X } from 'lucide-react';
import { entityTypeLabel } from '@/utils/formatters';
import { ENTITY_BG_CLASSES, TLP_LABELS } from '@/utils/constants';
import clsx from 'clsx';
import type { EntityType, TLPLevel } from '@/types';

const entityTypes: EntityType[] = [
  'person', 'organization', 'domain', 'ip', 'email', 'phone',
  'hash', 'malware', 'vulnerability', 'threat_actor', 'location',
];

const tlpLevels: TLPLevel[] = ['white', 'green', 'amber', 'amber-strict', 'red'];

interface FiltersState {
  types: EntityType[];
  sources: string[];
  minConfidence: number;
  maxConfidence: number;
  tlp: TLPLevel[];
  tags: string[];
  dateFrom: string;
  dateTo: string;
}

interface AdvancedFiltersProps {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
  onClose: () => void;
  availableSources?: string[];
  availableTags?: string[];
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onChange,
  onClose,
  availableSources = ['VirusTotal', 'Shodan', 'PassiveTotal', 'MITRE', 'OSINT', 'Manual'],
  availableTags = ['malicious', 'suspicious', 'benign', 'monitored', 'priority'],
}) => {
  const toggleType = (type: EntityType) => {
    const next = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types: next });
  };

  const toggleTlp = (level: TLPLevel) => {
    const next = filters.tlp.includes(level)
      ? filters.tlp.filter((t) => t !== level)
      : [...filters.tlp, level];
    onChange({ ...filters, tlp: next });
  };

  const toggleSource = (source: string) => {
    const next = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onChange({ ...filters, sources: next });
  };

  const toggleTag = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  };

  return (
    <div className="w-80 flex-shrink-0 bg-surface-900 border border-gray-700/50 rounded-xl p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-200">Filters</h3>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Entity Types */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Entity Type</label>
        <div className="flex flex-wrap gap-1.5">
          {entityTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-sm font-medium border transition-colors',
                filters.types.includes(type)
                  ? ENTITY_BG_CLASSES[type] + ' border-transparent'
                  : 'text-gray-400 bg-surface-800 border-gray-700/50 hover:text-gray-200'
              )}
            >
              {entityTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence Range */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Confidence: {filters.minConfidence}% - {filters.maxConfidence}%
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={filters.minConfidence}
            onChange={(e) => onChange({ ...filters, minConfidence: Number(e.target.value) })}
            className="flex-1 accent-blue-500"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={filters.maxConfidence}
            onChange={(e) => onChange({ ...filters, maxConfidence: Number(e.target.value) })}
            className="flex-1 accent-blue-500"
          />
        </div>
      </div>

      {/* TLP */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">TLP Level</label>
        <div className="flex flex-wrap gap-1.5">
          {tlpLevels.map((level) => (
            <button
              key={level}
              onClick={() => toggleTlp(level)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-sm font-medium border transition-colors',
                filters.tlp.includes(level)
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                  : 'text-gray-400 bg-surface-800 border-gray-700/50 hover:text-gray-200'
              )}
            >
              {TLP_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Source</label>
        <div className="space-y-1.5">
          {availableSources.map((source) => (
            <label key={source} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-surface-800">
              <input
                type="checkbox"
                checked={filters.sources.includes(source)}
                onChange={() => toggleSource(source)}
                className="rounded border-gray-600 bg-surface-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-base text-gray-300">{source}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Date Range</label>
        <div className="space-y-2">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="w-full px-3 py-2 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="w-full px-3 py-2 text-base bg-surface-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-sm border transition-colors',
                filters.tags.includes(tag)
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                  : 'text-gray-400 bg-surface-800 border-gray-700/50 hover:text-gray-200'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() =>
          onChange({
            types: [], sources: [], minConfidence: 0, maxConfidence: 100,
            tlp: [], tags: [], dateFrom: '', dateTo: '',
          })
        }
        className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        Reset all filters
      </button>
    </div>
  );
};
