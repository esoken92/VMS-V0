-- 0002_api_keys — scoped API keys for the REST v1 + MCP surface.
--
-- Plaintext keys are NEVER stored. At issue time the caller sees
-- `vms_<48 base64url chars>` once; we persist:
--   key_prefix — first 8 chars of the key (display/identification only)
--   key_hash   — sha256 hex of (MCP_API_KEY_SALT || ':' || key);
--                salt defaults to '' when the env var is unset, so local
--                installs work out of the box. NOTE: changing
--                MCP_API_KEY_SALT invalidates every previously issued key.
-- scopes is a text[] subset of {read, write, admin} enforced app-side
-- (defense-in-depth CHECK below) — the app-layer permission matrix still
-- governs what the key's owner role may actually do.
--
-- Idempotent so it can run on top of the supabase/migrations baseline.
CREATE TABLE IF NOT EXISTS "public"."api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{read}',
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "api_keys_scopes_subset"
    CHECK ("scopes" <@ ARRAY['read','write','admin']::text[]),
  CONSTRAINT "api_keys_key_hash_unique" UNIQUE ("key_hash")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_api_keys_user" ON "public"."api_keys" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_hash" ON "public"."api_keys" ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_active" ON "public"."api_keys" ("revoked_at") WHERE "revoked_at" IS NULL;--> statement-breakpoint
