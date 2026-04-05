export type TLPLevel = "WHITE" | "GREEN" | "AMBER" | "AMBER_STRICT" | "RED";

export type AdmiraltySourceReliability = "A" | "B" | "C" | "D" | "E" | "F";
export type AdmiraltyInformationCredibility = "1" | "2" | "3" | "4" | "5" | "6";

export interface SourceProvenance {
  moduleName: string;
  collectedAt: string;
  rawId?: string;
  url?: string;
  confidence: number;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface ContactInfo {
  type: "email" | "phone" | "address" | "fax" | "other";
  value: string;
  label?: string;
  verified: boolean;
}

export interface SocialMediaAccount {
  platform: string;
  username: string;
  profileUrl: string;
  verified: boolean;
  followers?: number;
  lastActive?: string;
}

export interface Employment {
  organization: string;
  title: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
}

export interface SanctionsMatch {
  listName: string;
  listId: string;
  matchScore: number;
  matchedName: string;
  designationDate?: string;
  source: string;
}

export interface Identifier {
  type: string;
  value: string;
  country?: string;
}

export interface RegistrationNumber {
  type: string;
  value: string;
  jurisdiction: string;
}

export interface Officer {
  name: string;
  role: string;
  appointedDate?: string;
  resignedDate?: string;
  nationality?: string;
}

export interface FinancialDataPoint {
  period: string;
  revenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  currency: string;
  source: string;
}

export interface SECFiling {
  formType: string;
  filedDate: string;
  accessionNumber: string;
  url: string;
  description?: string;
}

export interface DNSRecord {
  type: "A" | "AAAA" | "CNAME" | "MX" | "NS" | "TXT" | "SOA" | "SRV" | "PTR";
  name: string;
  value: string;
  ttl: number;
}

export interface SSLCertificate {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
  signatureAlgorithm: string;
}

export interface PortInfo {
  port: number;
  protocol: "tcp" | "udp";
  service?: string;
  version?: string;
  state: "open" | "closed" | "filtered";
  lastSeen: string;
}

export interface ThreatScore {
  source: string;
  score: number;
  maxScore: number;
  category?: string;
  lastUpdated: string;
}

export interface BreachRecord {
  breachName: string;
  breachDate: string;
  dataTypes: string[];
  source: string;
  verified: boolean;
}

export interface AssociatedAccount {
  platform: string;
  username: string;
  profileUrl?: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  counterparty?: string;
  description?: string;
  type: "credit" | "debit";
}

export interface TrackingData {
  timestamp: string;
  coordinates: GeoCoordinates;
  speed?: number;
  heading?: number;
  source: string;
}

export interface KillChainPhase {
  killChainName: string;
  phaseName: string;
}

export interface TTP {
  tacticId: string;
  tacticName: string;
  techniqueId: string;
  techniqueName: string;
  description?: string;
}

export interface AffectedProduct {
  vendor: string;
  product: string;
  versions: string[];
  cpe?: string;
}

export type EntityType =
  | "person"
  | "organization"
  | "location"
  | "domain"
  | "ip-address"
  | "email-address"
  | "phone-number"
  | "username"
  | "financial-account"
  | "vehicle"
  | "indicator"
  | "threat-actor"
  | "campaign"
  | "vulnerability"
  | "document"
  | "event";

export interface BaseEntity {
  id: string;
  entityType: EntityType;
  createdAt: string;
  updatedAt: string;
  sources: SourceProvenance[];
  confidence: number;
  admiraltySource: AdmiraltySourceReliability;
  admiraltyCredibility: AdmiraltyInformationCredibility;
  tlpLevel: TLPLevel;
  tags: string[];
}

export interface Person extends BaseEntity {
  entityType: "person";
  name: string;
  aliases: string[];
  dateOfBirth?: string;
  nationality: string[];
  identifiers: Identifier[];
  contactInfo: ContactInfo[];
  socialMedia: SocialMediaAccount[];
  employmentHistory: Employment[];
  pepStatus: boolean;
  sanctionsMatches: SanctionsMatch[];
}

export interface Organization extends BaseEntity {
  entityType: "organization";
  name: string;
  aliases: string[];
  registrationNumbers: RegistrationNumber[];
  jurisdiction: string;
  industry: string[];
  incorporationDate?: string;
  status: "active" | "inactive" | "dissolved" | "unknown";
  officers: Officer[];
  subsidiaries: string[];
  financialData: FinancialDataPoint[];
  secFilings: SECFiling[];
  sanctionsMatches: SanctionsMatch[];
}

export interface Location extends BaseEntity {
  entityType: "location";
  coordinates?: GeoCoordinates;
  address?: string;
  city?: string;
  stateProvince?: string;
  country: string;
  postalCode?: string;
  locationType: "address" | "city" | "region" | "country" | "coordinates" | "facility";
}

export interface Domain extends BaseEntity {
  entityType: "domain";
  domainName: string;
  registrar?: string;
  registrationDate?: string;
  expirationDate?: string;
  nameservers: string[];
  dnsRecords: DNSRecord[];
  sslCertificates: SSLCertificate[];
  subdomains: string[];
  technologies: string[];
  whoisRaw?: string;
}

export interface IPAddress extends BaseEntity {
  entityType: "ip-address";
  ip: string;
  version: 4 | 6;
  asn?: string;
  asOrg?: string;
  geolocation?: GeoCoordinates;
  ports: PortInfo[];
  threatScores: ThreatScore[];
  reverseDns: string[];
}

export interface EmailAddress extends BaseEntity {
  entityType: "email-address";
  email: string;
  provider?: string;
  verified: boolean;
  breachHistory: BreachRecord[];
  associatedAccounts: AssociatedAccount[];
}

export interface PhoneNumber extends BaseEntity {
  entityType: "phone-number";
  number: string;
  carrier?: string;
  type: "mobile" | "landline" | "voip" | "unknown";
  country?: string;
  ownerName?: string;
}

export interface Username extends BaseEntity {
  entityType: "username";
  username: string;
  platform: string;
  profileUrl?: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  createdDate?: string;
  lastActive?: string;
}

export interface FinancialAccount extends BaseEntity {
  entityType: "financial-account";
  accountType: "bank" | "crypto" | "brokerage" | "payment" | "other";
  institution: string;
  identifiers: Identifier[];
  currency: string;
  transactions: Transaction[];
}

export interface Vehicle extends BaseEntity {
  entityType: "vehicle";
  vehicleType: "car" | "truck" | "vessel" | "aircraft" | "other";
  registration: string;
  name?: string;
  owner?: string;
  flagState?: string;
  trackingData: TrackingData[];
}

export interface Indicator extends BaseEntity {
  entityType: "indicator";
  indicatorType: "ipv4" | "ipv6" | "domain" | "url" | "email" | "hash-md5" | "hash-sha1" | "hash-sha256" | "filename" | "mutex" | "registry-key" | "user-agent" | "cidr" | "other";
  value: string;
  pattern?: string;
  confidence: number;
  killChainPhases: KillChainPhase[];
  validFrom: string;
  validUntil?: string;
  malwareFamilies: string[];
}

export interface ThreatActor extends BaseEntity {
  entityType: "threat-actor";
  name: string;
  aliases: string[];
  description?: string;
  motivation: string[];
  sophistication: "none" | "minimal" | "intermediate" | "advanced" | "expert" | "innovator" | "strategic";
  country?: string;
  firstSeen?: string;
  lastSeen?: string;
  ttps: TTP[];
}

export interface Campaign extends BaseEntity {
  entityType: "campaign";
  name: string;
  description?: string;
  objective?: string;
  firstSeen?: string;
  lastSeen?: string;
  status: "ongoing" | "historic" | "future";
}

export interface Vulnerability extends BaseEntity {
  entityType: "vulnerability";
  cveId: string;
  description: string;
  cvssScore?: number;
  cvssVector?: string;
  severity: "none" | "low" | "medium" | "high" | "critical";
  affectedProducts: AffectedProduct[];
  exploitAvailable: boolean;
  cisaKev: boolean;
  publishedDate: string;
  lastModified: string;
  references: string[];
}

export interface Document extends BaseEntity {
  entityType: "document";
  title: string;
  source: string;
  sourceUrl?: string;
  content?: string;
  contentType: "article" | "report" | "filing" | "social-media" | "paste" | "other";
  language?: string;
  publishedDate?: string;
  hash?: string;
  filePath?: string;
}

export interface Event extends BaseEntity {
  entityType: "event";
  eventType: "conflict" | "protest" | "election" | "disaster" | "economic" | "cyber" | "diplomatic" | "other";
  description: string;
  timestamp: string;
  locationId?: string;
  actors: string[];
  sources: SourceProvenance[];
  gdeltEventId?: string;
  acledEventId?: string;
}

export type Entity =
  | Person
  | Organization
  | Location
  | Domain
  | IPAddress
  | EmailAddress
  | PhoneNumber
  | Username
  | FinancialAccount
  | Vehicle
  | Indicator
  | ThreatActor
  | Campaign
  | Vulnerability
  | Document
  | Event;
