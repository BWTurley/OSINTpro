import type { EntityType } from '@/types';

const IP_V4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IP_V6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$/;
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MD5_REGEX = /^[a-fA-F0-9]{32}$/;
const SHA1_REGEX = /^[a-fA-F0-9]{40}$/;
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const BTC_REGEX = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
const ETH_REGEX = /^0x[a-fA-F0-9]{40}$/;
const CVE_REGEX = /^CVE-\d{4}-\d{4,}$/i;

export function isValidIPv4(value: string): boolean {
  return IP_V4_REGEX.test(value.trim());
}

export function isValidIPv6(value: string): boolean {
  return IP_V6_REGEX.test(value.trim());
}

export function isValidIP(value: string): boolean {
  return isValidIPv4(value) || isValidIPv6(value);
}

export function isValidDomain(value: string): boolean {
  return DOMAIN_REGEX.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidHash(value: string): boolean {
  const v = value.trim();
  return MD5_REGEX.test(v) || SHA1_REGEX.test(v) || SHA256_REGEX.test(v);
}

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.replace(/[\s()-]/g, ''));
}

export function isValidCrypto(value: string): boolean {
  return BTC_REGEX.test(value.trim()) || ETH_REGEX.test(value.trim());
}

export function isValidCVE(value: string): boolean {
  return CVE_REGEX.test(value.trim());
}

export function detectEntityType(value: string): EntityType | null {
  const v = value.trim();
  if (isValidIPv4(v) || isValidIPv6(v)) return 'ip';
  if (isValidEmail(v)) return 'email';
  if (isValidHash(v)) return 'hash';
  if (isValidDomain(v)) return 'domain';
  if (isValidPhone(v)) return 'phone';
  if (isValidCrypto(v)) return 'cryptocurrency';
  if (isValidCVE(v)) return 'vulnerability';
  return null;
}

export function validateEntityValue(type: EntityType, value: string): string | null {
  switch (type) {
    case 'ip':
      return isValidIP(value) ? null : 'Invalid IP address';
    case 'domain':
      return isValidDomain(value) ? null : 'Invalid domain name';
    case 'email':
      return isValidEmail(value) ? null : 'Invalid email address';
    case 'hash':
      return isValidHash(value) ? null : 'Invalid hash (expected MD5, SHA-1, or SHA-256)';
    case 'phone':
      return isValidPhone(value) ? null : 'Invalid phone number';
    case 'cryptocurrency':
      return isValidCrypto(value) ? null : 'Invalid cryptocurrency address';
    case 'vulnerability':
      return isValidCVE(value) ? null : 'Invalid CVE identifier';
    default:
      return value.trim().length > 0 ? null : 'Value cannot be empty';
  }
}
