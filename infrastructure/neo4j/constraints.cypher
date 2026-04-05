// ============================================================
// Neo4j Constraints and Indexes for OSINT Dashboard
// ============================================================

// ---- Unique Constraints ----
// Each entity type gets a unique constraint on its id property.

CREATE CONSTRAINT person_id_unique IF NOT EXISTS
FOR (n:Person) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT organization_id_unique IF NOT EXISTS
FOR (n:Organization) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT domain_id_unique IF NOT EXISTS
FOR (n:Domain) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT ip_address_id_unique IF NOT EXISTS
FOR (n:IPAddress) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT email_address_id_unique IF NOT EXISTS
FOR (n:EmailAddress) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT phone_number_id_unique IF NOT EXISTS
FOR (n:PhoneNumber) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT social_media_account_id_unique IF NOT EXISTS
FOR (n:SocialMediaAccount) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT cryptocurrency_wallet_id_unique IF NOT EXISTS
FOR (n:CryptoWallet) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT location_id_unique IF NOT EXISTS
FOR (n:Location) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT vehicle_id_unique IF NOT EXISTS
FOR (n:Vehicle) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT document_id_unique IF NOT EXISTS
FOR (n:Document) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT url_id_unique IF NOT EXISTS
FOR (n:URL) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT file_hash_id_unique IF NOT EXISTS
FOR (n:FileHash) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT malware_id_unique IF NOT EXISTS
FOR (n:Malware) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT vulnerability_id_unique IF NOT EXISTS
FOR (n:Vulnerability) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT threat_actor_id_unique IF NOT EXISTS
FOR (n:ThreatActor) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT campaign_id_unique IF NOT EXISTS
FOR (n:Campaign) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT investigation_id_unique IF NOT EXISTS
FOR (n:Investigation) REQUIRE n.id IS UNIQUE;

// ---- Value-based Unique Constraints ----
// Prevent duplicate values for natural keys.

CREATE CONSTRAINT domain_name_unique IF NOT EXISTS
FOR (n:Domain) REQUIRE n.name IS UNIQUE;

CREATE CONSTRAINT ip_address_value_unique IF NOT EXISTS
FOR (n:IPAddress) REQUIRE n.address IS UNIQUE;

CREATE CONSTRAINT email_address_value_unique IF NOT EXISTS
FOR (n:EmailAddress) REQUIRE n.address IS UNIQUE;

CREATE CONSTRAINT file_hash_value_unique IF NOT EXISTS
FOR (n:FileHash) REQUIRE n.hash IS UNIQUE;

CREATE CONSTRAINT vulnerability_cve_unique IF NOT EXISTS
FOR (n:Vulnerability) REQUIRE n.cve_id IS UNIQUE;

// ---- Composite Indexes for Search Performance ----

CREATE INDEX person_name_idx IF NOT EXISTS
FOR (n:Person) ON (n.name);

CREATE INDEX organization_name_idx IF NOT EXISTS
FOR (n:Organization) ON (n.name);

CREATE INDEX domain_name_idx IF NOT EXISTS
FOR (n:Domain) ON (n.name);

CREATE INDEX ip_address_value_idx IF NOT EXISTS
FOR (n:IPAddress) ON (n.address);

CREATE INDEX email_address_value_idx IF NOT EXISTS
FOR (n:EmailAddress) ON (n.address);

CREATE INDEX social_media_handle_idx IF NOT EXISTS
FOR (n:SocialMediaAccount) ON (n.handle);

CREATE INDEX social_media_platform_idx IF NOT EXISTS
FOR (n:SocialMediaAccount) ON (n.platform);

CREATE INDEX crypto_wallet_address_idx IF NOT EXISTS
FOR (n:CryptoWallet) ON (n.address);

CREATE INDEX malware_name_idx IF NOT EXISTS
FOR (n:Malware) ON (n.name);

CREATE INDEX threat_actor_name_idx IF NOT EXISTS
FOR (n:ThreatActor) ON (n.name);

CREATE INDEX campaign_name_idx IF NOT EXISTS
FOR (n:Campaign) ON (n.name);

// ---- Investigation scoping ----

CREATE INDEX person_investigation_idx IF NOT EXISTS
FOR (n:Person) ON (n.investigation_id);

CREATE INDEX organization_investigation_idx IF NOT EXISTS
FOR (n:Organization) ON (n.investigation_id);

CREATE INDEX domain_investigation_idx IF NOT EXISTS
FOR (n:Domain) ON (n.investigation_id);

CREATE INDEX ip_investigation_idx IF NOT EXISTS
FOR (n:IPAddress) ON (n.investigation_id);

// ---- Temporal Indexes ----

CREATE INDEX person_created_idx IF NOT EXISTS
FOR (n:Person) ON (n.created_at);

CREATE INDEX domain_first_seen_idx IF NOT EXISTS
FOR (n:Domain) ON (n.first_seen);

CREATE INDEX ip_first_seen_idx IF NOT EXISTS
FOR (n:IPAddress) ON (n.first_seen);

// ---- Full-text Search Index ----

CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS
FOR (n:Person|Organization|Domain|IPAddress|EmailAddress|ThreatActor|Campaign|Malware)
ON EACH [n.name, n.description];
