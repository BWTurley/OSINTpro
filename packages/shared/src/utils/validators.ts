const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

const IPV6_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3})$/;

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

const MD5_REGEX = /^[a-fA-F0-9]{32}$/;
const SHA1_REGEX = /^[a-fA-F0-9]{40}$/;
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;
const SHA512_REGEX = /^[a-fA-F0-9]{128}$/;

const CVE_REGEX = /^CVE-\d{4}-\d{4,}$/;

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const LOOSE_PHONE_REGEX = /^[+]?[\d\s\-().]{7,20}$/;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function isValidEmail(value: string): boolean {
  if (!value || value.length > 254) return false;
  return EMAIL_REGEX.test(value);
}

export function isValidIP(value: string): boolean {
  if (!value) return false;
  return isValidIPv4(value) || isValidIPv6(value);
}

export function isValidIPv4(value: string): boolean {
  if (!value) return false;
  return IPV4_REGEX.test(value);
}

export function isValidIPv6(value: string): boolean {
  if (!value) return false;
  return IPV6_REGEX.test(value);
}

export function isValidDomain(value: string): boolean {
  if (!value || value.length > 253) return false;
  return DOMAIN_REGEX.test(value);
}

export type HashType = "md5" | "sha1" | "sha256" | "sha512" | "unknown";

export function isValidHash(value: string, type?: HashType): boolean {
  if (!value) return false;

  if (type) {
    switch (type) {
      case "md5":
        return MD5_REGEX.test(value);
      case "sha1":
        return SHA1_REGEX.test(value);
      case "sha256":
        return SHA256_REGEX.test(value);
      case "sha512":
        return SHA512_REGEX.test(value);
      default:
        return false;
    }
  }

  return (
    MD5_REGEX.test(value) ||
    SHA1_REGEX.test(value) ||
    SHA256_REGEX.test(value) ||
    SHA512_REGEX.test(value)
  );
}

export function detectHashType(value: string): HashType {
  if (!value) return "unknown";
  if (MD5_REGEX.test(value)) return "md5";
  if (SHA1_REGEX.test(value)) return "sha1";
  if (SHA256_REGEX.test(value)) return "sha256";
  if (SHA512_REGEX.test(value)) return "sha512";
  return "unknown";
}

export function isValidCVE(value: string): boolean {
  if (!value) return false;
  return CVE_REGEX.test(value.toUpperCase());
}

export function isValidPhoneNumber(value: string, strict = false): boolean {
  if (!value) return false;
  if (strict) {
    return E164_REGEX.test(value.replace(/\s/g, ""));
  }
  return LOOSE_PHONE_REGEX.test(value);
}

export function isValidUUID(value: string): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEntityInput(
  entityType: string,
  data: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];

  switch (entityType) {
    case "email-address": {
      const email = data["email"] as string | undefined;
      if (!email) errors.push("Email address is required.");
      else if (!isValidEmail(email)) errors.push(`Invalid email address: ${email}`);
      break;
    }
    case "ip-address": {
      const ip = data["ip"] as string | undefined;
      if (!ip) errors.push("IP address is required.");
      else if (!isValidIP(ip)) errors.push(`Invalid IP address: ${ip}`);
      break;
    }
    case "domain": {
      const domain = data["domainName"] as string | undefined;
      if (!domain) errors.push("Domain name is required.");
      else if (!isValidDomain(domain)) errors.push(`Invalid domain: ${domain}`);
      break;
    }
    case "phone-number": {
      const phone = data["number"] as string | undefined;
      if (!phone) errors.push("Phone number is required.");
      else if (!isValidPhoneNumber(phone)) errors.push(`Invalid phone number: ${phone}`);
      break;
    }
    case "vulnerability": {
      const cve = data["cveId"] as string | undefined;
      if (!cve) errors.push("CVE ID is required.");
      else if (!isValidCVE(cve)) errors.push(`Invalid CVE ID: ${cve}. Expected format: CVE-YYYY-NNNNN`);
      break;
    }
    case "person": {
      const name = data["name"] as string | undefined;
      if (!name || name.trim().length === 0) errors.push("Person name is required.");
      break;
    }
    case "organization": {
      const name = data["name"] as string | undefined;
      if (!name || name.trim().length === 0) errors.push("Organization name is required.");
      break;
    }
    case "indicator": {
      const value = data["value"] as string | undefined;
      const indicatorType = data["indicatorType"] as string | undefined;
      if (!value) errors.push("Indicator value is required.");
      if (!indicatorType) errors.push("Indicator type is required.");
      break;
    }
    case "threat-actor": {
      const name = data["name"] as string | undefined;
      if (!name || name.trim().length === 0) errors.push("Threat actor name is required.");
      break;
    }
    case "campaign": {
      const name = data["name"] as string | undefined;
      if (!name || name.trim().length === 0) errors.push("Campaign name is required.");
      break;
    }
    case "username": {
      const username = data["username"] as string | undefined;
      const platform = data["platform"] as string | undefined;
      if (!username) errors.push("Username is required.");
      if (!platform) errors.push("Platform is required.");
      break;
    }
    case "document": {
      const title = data["title"] as string | undefined;
      if (!title || title.trim().length === 0) errors.push("Document title is required.");
      break;
    }
    case "location": {
      const country = data["country"] as string | undefined;
      if (!country || country.trim().length === 0) errors.push("Country is required.");
      break;
    }
    case "vehicle": {
      const registration = data["registration"] as string | undefined;
      if (!registration || registration.trim().length === 0) errors.push("Vehicle registration is required.");
      break;
    }
    case "financial-account": {
      const institution = data["institution"] as string | undefined;
      if (!institution || institution.trim().length === 0) errors.push("Financial institution is required.");
      break;
    }
    case "event": {
      const description = data["description"] as string | undefined;
      const timestamp = data["timestamp"] as string | undefined;
      if (!description) errors.push("Event description is required.");
      if (!timestamp) errors.push("Event timestamp is required.");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}
