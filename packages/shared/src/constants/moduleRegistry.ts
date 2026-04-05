import type { ModuleCategory } from "../types/collection.js";

export interface ModuleRegistryEntry {
  name: string;
  displayName: string;
  category: ModuleCategory;
  description: string;
  supportedEntityTypes: string[];
  requiresApiKey: boolean;
  website: string;
  defaultRateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  defaultCacheTTL: number;
}

export const MODULE_REGISTRY: Record<string, ModuleRegistryEntry> = {
  // People modules
  "pipl": {
    name: "pipl",
    displayName: "Pipl",
    category: "people",
    description: "People search engine for identity resolution and background data.",
    supportedEntityTypes: ["person", "email-address", "phone-number", "username"],
    requiresApiKey: true,
    website: "https://pipl.com",
    defaultRateLimit: { maxRequests: 100, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },
  "fullcontact": {
    name: "fullcontact",
    displayName: "FullContact",
    category: "people",
    description: "Identity resolution and person enrichment API.",
    supportedEntityTypes: ["person", "email-address", "phone-number"],
    requiresApiKey: true,
    website: "https://fullcontact.com",
    defaultRateLimit: { maxRequests: 300, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },

  // Company modules
  "opencorporates": {
    name: "opencorporates",
    displayName: "OpenCorporates",
    category: "companies",
    description: "Open database of companies worldwide with registration data.",
    supportedEntityTypes: ["organization"],
    requiresApiKey: true,
    website: "https://opencorporates.com",
    defaultRateLimit: { maxRequests: 50, windowMs: 60000 },
    defaultCacheTTL: 604800000,
  },
  "sec-edgar": {
    name: "sec-edgar",
    displayName: "SEC EDGAR",
    category: "companies",
    description: "US Securities and Exchange Commission filings database.",
    supportedEntityTypes: ["organization", "person"],
    requiresApiKey: false,
    website: "https://www.sec.gov/edgar",
    defaultRateLimit: { maxRequests: 10, windowMs: 1000 },
    defaultCacheTTL: 3600000,
  },

  // Domain modules
  "whois": {
    name: "whois",
    displayName: "WHOIS Lookup",
    category: "domains",
    description: "Domain registration and ownership data via WHOIS protocol.",
    supportedEntityTypes: ["domain"],
    requiresApiKey: false,
    website: "https://whois.icann.org",
    defaultRateLimit: { maxRequests: 30, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },
  "securitytrails": {
    name: "securitytrails",
    displayName: "SecurityTrails",
    category: "domains",
    description: "Historical DNS, WHOIS, and subdomain data.",
    supportedEntityTypes: ["domain", "ip-address"],
    requiresApiKey: true,
    website: "https://securitytrails.com",
    defaultRateLimit: { maxRequests: 50, windowMs: 60000 },
    defaultCacheTTL: 3600000,
  },
  "urlscan": {
    name: "urlscan",
    displayName: "URLScan.io",
    category: "domains",
    description: "Website scanning and analysis service.",
    supportedEntityTypes: ["domain"],
    requiresApiKey: true,
    website: "https://urlscan.io",
    defaultRateLimit: { maxRequests: 60, windowMs: 60000 },
    defaultCacheTTL: 3600000,
  },
  "builtwith": {
    name: "builtwith",
    displayName: "BuiltWith",
    category: "domains",
    description: "Technology profiling and lead generation for websites.",
    supportedEntityTypes: ["domain"],
    requiresApiKey: true,
    website: "https://builtwith.com",
    defaultRateLimit: { maxRequests: 20, windowMs: 60000 },
    defaultCacheTTL: 604800000,
  },

  // IP Address modules
  "shodan": {
    name: "shodan",
    displayName: "Shodan",
    category: "ip-addresses",
    description: "Internet-wide scanning for devices, services, and vulnerabilities.",
    supportedEntityTypes: ["ip-address", "domain"],
    requiresApiKey: true,
    website: "https://shodan.io",
    defaultRateLimit: { maxRequests: 1, windowMs: 1000 },
    defaultCacheTTL: 3600000,
  },
  "censys": {
    name: "censys",
    displayName: "Censys",
    category: "ip-addresses",
    description: "Internet-wide scanning focused on certificates and hosts.",
    supportedEntityTypes: ["ip-address", "domain"],
    requiresApiKey: true,
    website: "https://censys.io",
    defaultRateLimit: { maxRequests: 120, windowMs: 300000 },
    defaultCacheTTL: 3600000,
  },
  "greynoise": {
    name: "greynoise",
    displayName: "GreyNoise",
    category: "ip-addresses",
    description: "Internet background noise analysis and IP context.",
    supportedEntityTypes: ["ip-address"],
    requiresApiKey: true,
    website: "https://greynoise.io",
    defaultRateLimit: { maxRequests: 500, windowMs: 86400000 },
    defaultCacheTTL: 3600000,
  },
  "abuseipdb": {
    name: "abuseipdb",
    displayName: "AbuseIPDB",
    category: "ip-addresses",
    description: "IP address abuse reporting and checking database.",
    supportedEntityTypes: ["ip-address"],
    requiresApiKey: true,
    website: "https://abuseipdb.com",
    defaultRateLimit: { maxRequests: 1000, windowMs: 86400000 },
    defaultCacheTTL: 3600000,
  },

  // Email modules
  "haveibeenpwned": {
    name: "haveibeenpwned",
    displayName: "Have I Been Pwned",
    category: "breach-data",
    description: "Data breach aggregation and notification service.",
    supportedEntityTypes: ["email-address"],
    requiresApiKey: true,
    website: "https://haveibeenpwned.com",
    defaultRateLimit: { maxRequests: 10, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },
  "emailrep": {
    name: "emailrep",
    displayName: "EmailRep",
    category: "email",
    description: "Email address reputation and risk scoring.",
    supportedEntityTypes: ["email-address"],
    requiresApiKey: true,
    website: "https://emailrep.io",
    defaultRateLimit: { maxRequests: 20, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },
  "hunter": {
    name: "hunter",
    displayName: "Hunter.io",
    category: "email",
    description: "Email finder and domain-level email discovery.",
    supportedEntityTypes: ["email-address", "domain", "organization"],
    requiresApiKey: true,
    website: "https://hunter.io",
    defaultRateLimit: { maxRequests: 30, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },

  // Phone modules
  "numverify": {
    name: "numverify",
    displayName: "Numverify",
    category: "phone",
    description: "Phone number validation and carrier lookup.",
    supportedEntityTypes: ["phone-number"],
    requiresApiKey: true,
    website: "https://numverify.com",
    defaultRateLimit: { maxRequests: 100, windowMs: 60000 },
    defaultCacheTTL: 604800000,
  },

  // Social media modules
  "social-analyzer": {
    name: "social-analyzer",
    displayName: "Social Analyzer",
    category: "social-media",
    description: "Username search across hundreds of social networks.",
    supportedEntityTypes: ["username"],
    requiresApiKey: false,
    website: "https://github.com/qeeqbox/social-analyzer",
    defaultRateLimit: { maxRequests: 5, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },

  // Threat intel modules
  "virustotal": {
    name: "virustotal",
    displayName: "VirusTotal",
    category: "threat-intel",
    description: "File and URL scanning with 70+ antivirus engines.",
    supportedEntityTypes: ["domain", "ip-address", "indicator"],
    requiresApiKey: true,
    website: "https://virustotal.com",
    defaultRateLimit: { maxRequests: 4, windowMs: 60000 },
    defaultCacheTTL: 3600000,
  },
  "alienvault-otx": {
    name: "alienvault-otx",
    displayName: "AlienVault OTX",
    category: "threat-intel",
    description: "Open threat intelligence community and indicator sharing.",
    supportedEntityTypes: ["ip-address", "domain", "indicator"],
    requiresApiKey: true,
    website: "https://otx.alienvault.com",
    defaultRateLimit: { maxRequests: 100, windowMs: 60000 },
    defaultCacheTTL: 3600000,
  },
  "misp": {
    name: "misp",
    displayName: "MISP",
    category: "threat-intel",
    description: "Malware Information Sharing Platform and threat sharing.",
    supportedEntityTypes: ["indicator", "threat-actor", "campaign"],
    requiresApiKey: true,
    website: "https://www.misp-project.org",
    defaultRateLimit: { maxRequests: 100, windowMs: 60000 },
    defaultCacheTTL: 1800000,
  },
  "nvd": {
    name: "nvd",
    displayName: "NVD",
    category: "threat-intel",
    description: "NIST National Vulnerability Database for CVE data.",
    supportedEntityTypes: ["vulnerability"],
    requiresApiKey: false,
    website: "https://nvd.nist.gov",
    defaultRateLimit: { maxRequests: 30, windowMs: 30000 },
    defaultCacheTTL: 3600000,
  },

  // Financial modules
  "opensanctions": {
    name: "opensanctions",
    displayName: "OpenSanctions",
    category: "sanctions",
    description: "International sanctions, PEP, and criminal watchlist data.",
    supportedEntityTypes: ["person", "organization"],
    requiresApiKey: true,
    website: "https://opensanctions.org",
    defaultRateLimit: { maxRequests: 100, windowMs: 60000 },
    defaultCacheTTL: 86400000,
  },

  // Geospatial modules
  "gdelt": {
    name: "gdelt",
    displayName: "GDELT Project",
    category: "geospatial",
    description: "Global database of events, language, and tone monitoring world news.",
    supportedEntityTypes: ["event", "location", "person", "organization"],
    requiresApiKey: false,
    website: "https://gdeltproject.org",
    defaultRateLimit: { maxRequests: 10, windowMs: 60000 },
    defaultCacheTTL: 3600000,
  },

  // Document modules
  "pastebin": {
    name: "pastebin",
    displayName: "Pastebin Search",
    category: "documents",
    description: "Monitoring and searching paste sites for leaked data.",
    supportedEntityTypes: ["document", "email-address", "domain"],
    requiresApiKey: true,
    website: "https://pastebin.com",
    defaultRateLimit: { maxRequests: 10, windowMs: 60000 },
    defaultCacheTTL: 1800000,
  },

  // Dark web modules
  "tor-search": {
    name: "tor-search",
    displayName: "Tor Hidden Services Search",
    category: "dark-web",
    description: "Search engine for indexed Tor hidden services.",
    supportedEntityTypes: ["domain", "email-address", "username"],
    requiresApiKey: true,
    website: "",
    defaultRateLimit: { maxRequests: 5, windowMs: 60000 },
    defaultCacheTTL: 3600000,
  },
};

export const MODULE_CATEGORIES: { category: ModuleCategory; label: string; description: string }[] = [
  { category: "people", label: "People Search", description: "Identity resolution and background checks" },
  { category: "companies", label: "Company Intelligence", description: "Corporate registrations, filings, and ownership" },
  { category: "domains", label: "Domain Intelligence", description: "DNS, WHOIS, and web technology analysis" },
  { category: "ip-addresses", label: "IP Intelligence", description: "Geolocation, ASN, and network scanning" },
  { category: "email", label: "Email Intelligence", description: "Email validation, reputation, and discovery" },
  { category: "phone", label: "Phone Intelligence", description: "Phone number validation and carrier lookup" },
  { category: "social-media", label: "Social Media", description: "Username search and profile aggregation" },
  { category: "threat-intel", label: "Threat Intelligence", description: "IOC lookup, malware, and vulnerability data" },
  { category: "financial", label: "Financial Intelligence", description: "Transaction monitoring and AML screening" },
  { category: "geospatial", label: "Geospatial Intelligence", description: "Event monitoring and location analysis" },
  { category: "documents", label: "Document Search", description: "Paste sites, leaked documents, and OSINT feeds" },
  { category: "dark-web", label: "Dark Web", description: "Tor hidden services and underground marketplace monitoring" },
  { category: "sanctions", label: "Sanctions & Watchlists", description: "Sanctions screening and PEP checks" },
  { category: "breach-data", label: "Breach Data", description: "Data breach monitoring and credential exposure" },
];

export function getModulesByCategory(category: ModuleCategory): ModuleRegistryEntry[] {
  return Object.values(MODULE_REGISTRY).filter((m) => m.category === category);
}

export function getModulesForEntityType(entityType: string): ModuleRegistryEntry[] {
  return Object.values(MODULE_REGISTRY).filter((m) =>
    m.supportedEntityTypes.includes(entityType)
  );
}

export function getModuleByName(name: string): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY[name];
}

export const ALL_MODULE_NAMES = Object.keys(MODULE_REGISTRY);
