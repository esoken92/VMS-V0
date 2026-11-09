-- 0000_local_auth — app-managed credentials auth delta.
-- Argon2id password hash for the Auth.js credentials provider.
-- Idempotent so it can run on top of the supabase/migrations baseline
-- (which already includes the equivalent ALTER in 011_app_auth.sql).
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
