-- ============================================================================
-- BOOTSTRAP SHIM for plain-Postgres self-hosting (runs first via initdb).
-- ============================================================================
-- The original migrations were written for Supabase and reference objects that
-- do not exist on a standalone Postgres instance:
--   * the `auth` schema (`auth.users`, `auth.uid()`)
--   * the `authenticated` / `anon` roles used by RLS policies and GRANTs
--   * the `storage` schema (`storage.buckets`, `storage.objects`)
--
-- This file provides minimal compatible stubs so 001-009 apply unchanged.
-- Authorization is enforced in the application layer (lib/auth/permissions.ts);
-- the database user connecting from the app owns these tables, so RLS policies
-- created by later migrations are inert defense-in-depth only.
-- ============================================================================

-- Extensions are also created in 001, but auth.users below needs uuid-ossp now.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- auth schema stub
-- ============================================================================
-- `profiles.id == auth.users.id` (1:1) is the convention the app and migrations
-- rely on. The app reads `email` here; password verification uses
-- `profiles.password_hash` (argon2id, added by drizzle migration 0000).
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE
);

-- Supabase's auth.uid() returned the JWT subject. Under plain Postgres there is
-- no JWT, so this stub returns NULL. The audit trigger (002) reads the user id
-- from `current_setting('request.jwt.claim.sub')` first — the app sets that via
-- set_config() inside every mutating transaction, so attribution still works.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid;
$$;

-- ============================================================================
-- Roles expected by RLS policies / GRANTs in later migrations
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

-- ============================================================================
-- storage schema stub (008 creates policies on storage.objects)
-- ============================================================================
-- Object storage itself is provided by the app's local-FS driver
-- (app/api/uploads, ./storage dir or S3-compatible env vars — see
-- docs/INTEGRATIONS.md). These tables exist only so migration 008 applies.
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
