import type { TLPLevel, AdmiraltySourceReliability, AdmiraltyInformationCredibility } from "../types/entities.js";
import { TLP_DEFINITIONS } from "../constants/tlpLevels.js";
import { SOURCE_RELIABILITY, INFORMATION_CREDIBILITY } from "../constants/admiraltyCode.js";

export function formatDate(
  dateString: string,
  options?: {
    includeTime?: boolean;
    relative?: boolean;
    locale?: string;
  }
): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid date";

  const locale = options?.locale ?? "en-US";

  if (options?.relative) {
    return formatRelativeDate(date);
  }

  if (options?.includeTime) {
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(Math.abs(diffMs) / 1000);
  const isFuture = diffMs < 0;

  if (diffSecs < 60) {
    return isFuture ? "in a few seconds" : "just now";
  }

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    const label = diffMins === 1 ? "minute" : "minutes";
    return isFuture ? `in ${diffMins} ${label}` : `${diffMins} ${label} ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    const label = diffHours === 1 ? "hour" : "hours";
    return isFuture ? `in ${diffHours} ${label}` : `${diffHours} ${label} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    const label = diffDays === 1 ? "day" : "days";
    return isFuture ? `in ${diffDays} ${label}` : `${diffDays} ${label} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    const label = diffMonths === 1 ? "month" : "months";
    return isFuture ? `in ${diffMonths} ${label}` : `${diffMonths} ${label} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  const label = diffYears === 1 ? "year" : "years";
  return isFuture ? `in ${diffYears} ${label}` : `${diffYears} ${label} ago`;
}

export function formatConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (pct >= 90) return `${pct}% (Very High)`;
  if (pct >= 70) return `${pct}% (High)`;
  if (pct >= 50) return `${pct}% (Medium)`;
  if (pct >= 30) return `${pct}% (Low)`;
  return `${pct}% (Very Low)`;
}

export function formatConfidenceShort(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function confidenceToColor(confidence: number): string {
  if (confidence >= 0.9) return "#22c55e";
  if (confidence >= 0.7) return "#84cc16";
  if (confidence >= 0.5) return "#eab308";
  if (confidence >= 0.3) return "#f97316";
  return "#ef4444";
}

export function formatAdmiraltyCode(
  source: AdmiraltySourceReliability,
  credibility: AdmiraltyInformationCredibility
): string {
  const srcDef = SOURCE_RELIABILITY[source];
  const credDef = INFORMATION_CREDIBILITY[credibility];
  return `${source}${credibility} (${srcDef.label} / ${credDef.label})`;
}

export function formatAdmiraltyCodeCompact(
  source: AdmiraltySourceReliability,
  credibility: AdmiraltyInformationCredibility
): string {
  return `${source}${credibility}`;
}

export function formatTLP(level: TLPLevel): string {
  return TLP_DEFINITIONS[level].label;
}

export function formatTLPWithDescription(level: TLPLevel): string {
  const def = TLP_DEFINITIONS[level];
  return `${def.label}: ${def.description}`;
}

export function getTLPColor(level: TLPLevel): string {
  return TLP_DEFINITIONS[level].color;
}

export function getTLPBgColor(level: TLPLevel): string {
  return TLP_DEFINITIONS[level].bgColor;
}

export function truncateText(text: string, maxLength: number, suffix = "..."): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) {
    return truncated.slice(0, lastSpace) + suffix;
  }
  return truncated + suffix;
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatFileSize(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return `-${formatFileSize(-bytes, decimals)}`;

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, FILE_SIZE_UNITS.length - 1);
  const value = bytes / Math.pow(k, unitIndex);

  return `${value.toFixed(decimals)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

export function formatNumber(value: number, locale = "en-US"): string {
  return value.toLocaleString(locale);
}

export function formatEntityType(entityType: string): string {
  return entityType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}
