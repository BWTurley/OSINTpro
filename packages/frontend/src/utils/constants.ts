import type { EntityType, TLPLevel, Severity, CaseStatus, ConfidenceLevel } from '@/types';

// ─── Entity Type Colors ──────────────────────────────────────────

export const ENTITY_COLORS: Record<EntityType, string> = {
  person: '#3b82f6',
  organization: '#8b5cf6',
  domain: '#06b6d4',
  ip: '#f59e0b',
  email: '#10b981',
  phone: '#ec4899',
  hash: '#6366f1',
  cryptocurrency: '#f97316',
  vehicle: '#84cc16',
  location: '#ef4444',
  event: '#14b8a6',
  malware: '#dc2626',
  vulnerability: '#d946ef',
  threat_actor: '#be123c',
};

export const ENTITY_BG_CLASSES: Record<EntityType, string> = {
  person: 'bg-blue-500/20 text-blue-400',
  organization: 'bg-violet-500/20 text-violet-400',
  domain: 'bg-cyan-500/20 text-cyan-400',
  ip: 'bg-amber-500/20 text-amber-400',
  email: 'bg-emerald-500/20 text-emerald-400',
  phone: 'bg-pink-500/20 text-pink-400',
  hash: 'bg-indigo-500/20 text-indigo-400',
  cryptocurrency: 'bg-orange-500/20 text-orange-400',
  vehicle: 'bg-lime-500/20 text-lime-400',
  location: 'bg-red-500/20 text-red-400',
  event: 'bg-teal-500/20 text-teal-400',
  malware: 'bg-red-600/20 text-red-500',
  vulnerability: 'bg-fuchsia-500/20 text-fuchsia-400',
  threat_actor: 'bg-rose-700/20 text-rose-400',
};

export const ENTITY_ICONS: Record<EntityType, string> = {
  person: 'User',
  organization: 'Building2',
  domain: 'Globe',
  ip: 'Server',
  email: 'Mail',
  phone: 'Phone',
  hash: 'Hash',
  cryptocurrency: 'Bitcoin',
  vehicle: 'Car',
  location: 'MapPin',
  event: 'Calendar',
  malware: 'Bug',
  vulnerability: 'ShieldAlert',
  threat_actor: 'Skull',
};

// ─── TLP Colors ──────────────────────────────────────────────────

export const TLP_COLORS: Record<TLPLevel, string> = {
  white: '#ffffff',
  green: '#22c55e',
  amber: '#f59e0b',
  'amber-strict': '#d97706',
  red: '#ef4444',
};

export const TLP_BG_CLASSES: Record<TLPLevel, string> = {
  white: 'bg-white/10 text-gray-100 border border-gray-400',
  green: 'bg-green-500/20 text-green-400',
  amber: 'bg-amber-500/20 text-amber-400',
  'amber-strict': 'bg-amber-600/20 text-amber-500',
  red: 'bg-red-500/20 text-red-400',
};

export const TLP_LABELS: Record<TLPLevel, string> = {
  white: 'TLP:WHITE',
  green: 'TLP:GREEN',
  amber: 'TLP:AMBER',
  'amber-strict': 'TLP:AMBER+STRICT',
  red: 'TLP:RED',
};

// ─── Severity Colors ─────────────────────────────────────────────

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
};

export const SEVERITY_BG_CLASSES: Record<Severity, string> = {
  critical: 'bg-red-600/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
  info: 'bg-blue-500/20 text-blue-400',
};

// ─── Case Status ─────────────────────────────────────────────────

export const CASE_STATUS_CLASSES: Record<CaseStatus, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  closed: 'bg-green-500/20 text-green-400',
  archived: 'bg-gray-500/20 text-gray-400',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending: 'Pending',
  closed: 'Closed',
  archived: 'Archived',
};

// ─── Confidence / Admiralty ──────────────────────────────────────

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  confirmed: 'Confirmed',
  probably_true: 'Probably True',
  possibly_true: 'Possibly True',
  doubtful: 'Doubtful',
  improbable: 'Improbable',
  unknown: 'Unknown',
};

export const RELIABILITY_LABELS: Record<string, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Reliability Cannot Be Judged',
};

export const CREDIBILITY_LABELS: Record<string, string> = {
  '1': 'Confirmed',
  '2': 'Probably True',
  '3': 'Possibly True',
  '4': 'Doubtfully True',
  '5': 'Improbable',
  '6': 'Truth Cannot Be Judged',
};

// ─── Route Paths ─────────────────────────────────────────────────

export const ROUTES = {
  HOME: '/',
  CASES: '/cases',
  CASE_DETAIL: '/cases/:id',
  GRAPH: '/graph',
  MAP: '/map',
  THREATS: '/threats',
  COLLECTION: '/collection',
  SEARCH: '/search',
  REPORTS: '/reports',
  ADMIN: '/admin',
  LOGIN: '/login',
} as const;

// ─── MITRE ATT&CK Tactics ───────────────────────────────────────

export const MITRE_TACTICS = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
] as const;
