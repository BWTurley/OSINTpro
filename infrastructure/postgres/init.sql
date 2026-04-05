-- ============================================================
-- PostgreSQL Initialization for OSINT Dashboard
-- Runs once when the container is first created.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions (password hashing, encryption)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable trigram indexes for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Verify extensions are loaded
DO $$
BEGIN
  RAISE NOTICE 'Extensions loaded:';
  RAISE NOTICE '  uuid-ossp: %', (SELECT installed_version FROM pg_available_extensions WHERE name = 'uuid-ossp');
  RAISE NOTICE '  pgcrypto:  %', (SELECT installed_version FROM pg_available_extensions WHERE name = 'pgcrypto');
  RAISE NOTICE '  pg_trgm:   %', (SELECT installed_version FROM pg_available_extensions WHERE name = 'pg_trgm');
END
$$;
