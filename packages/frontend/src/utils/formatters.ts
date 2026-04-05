import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { ConfidenceLevel, AdmiraltyCode } from '@/types';
import { RELIABILITY_LABELS, CREDIBILITY_LABELS } from './constants';

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatTimestamp(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return dateStr;
  }
}

export function formatConfidence(value: number): string {
  if (value >= 90) return 'Confirmed';
  if (value >= 70) return 'Probably True';
  if (value >= 50) return 'Possibly True';
  if (value >= 30) return 'Doubtful';
  if (value > 0) return 'Improbable';
  return 'Unknown';
}

export function confidenceToLevel(value: number): ConfidenceLevel {
  if (value >= 90) return 'confirmed';
  if (value >= 70) return 'probably_true';
  if (value >= 50) return 'possibly_true';
  if (value >= 30) return 'doubtful';
  if (value > 0) return 'improbable';
  return 'unknown';
}

export function confidenceColor(value: number): string {
  if (value >= 90) return 'text-green-400';
  if (value >= 70) return 'text-blue-400';
  if (value >= 50) return 'text-yellow-400';
  if (value >= 30) return 'text-orange-400';
  return 'text-red-400';
}

export function formatAdmiraltyCode(code: AdmiraltyCode): string {
  return `${code.reliability}${code.credibility}`;
}

export function describeAdmiraltyCode(code: AdmiraltyCode): string {
  const reliability = RELIABILITY_LABELS[code.reliability] ?? 'Unknown';
  const credibility = CREDIBILITY_LABELS[code.credibility] ?? 'Unknown';
  return `${reliability} / ${credibility}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function entityTypeLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
