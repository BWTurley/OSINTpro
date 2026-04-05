import React from 'react';
import clsx from 'clsx';
import { formatConfidence, formatAdmiraltyCode, describeAdmiraltyCode, confidenceColor } from '@/utils/formatters';
import type { AdmiraltyCode } from '@/types';

interface ConfidenceBadgeProps {
  confidence: number;
  admiraltyCode?: AdmiraltyCode;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  admiraltyCode,
  size = 'sm',
  showLabel = true,
}) => {
  const color = confidenceColor(confidence);
  const label = formatConfidence(confidence);

  return (
    <div className="flex items-center gap-2" title={admiraltyCode ? describeAdmiraltyCode(admiraltyCode) : label}>
      {/* Confidence bar */}
      <div
        className={clsx(
          'flex items-center gap-1.5',
          size === 'sm' ? 'h-5' : 'h-6'
        )}
      >
        <div className="flex gap-0.5">
          {[0, 25, 50, 75, 100].map((threshold) => (
            <div
              key={threshold}
              className={clsx(
                'rounded-sm',
                size === 'sm' ? 'w-1.5 h-4' : 'w-2 h-5',
                confidence >= threshold ? color.replace('text-', 'bg-') : 'bg-surface-700'
              )}
            />
          ))}
        </div>
        <span className={clsx('text-sm font-medium', color)}>{confidence}%</span>
      </div>

      {/* Admiralty code */}
      {admiraltyCode && (
        <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-surface-800 text-gray-300 border border-gray-700">
          {formatAdmiraltyCode(admiraltyCode)}
        </span>
      )}

      {/* Label */}
      {showLabel && (
        <span className={clsx('text-sm', color)}>{label}</span>
      )}
    </div>
  );
};
