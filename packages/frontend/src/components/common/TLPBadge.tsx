import React from 'react';
import clsx from 'clsx';
import type { TLPLevel } from '@/types';
import { TLP_BG_CLASSES, TLP_LABELS } from '@/utils/constants';

interface TLPBadgeProps {
  level: TLPLevel;
  size?: 'sm' | 'md';
  className?: string;
}

export const TLPBadge: React.FC<TLPBadgeProps> = ({ level, size = 'sm', className }) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-semibold rounded-full uppercase tracking-wide',
        TLP_BG_CLASSES[level],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
    >
      {TLP_LABELS[level]}
    </span>
  );
};
