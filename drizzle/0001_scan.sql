-- 0001_scan — scan-first feature set.
--
-- scan_events: append-only forensic log of every scan attempt (success AND
-- failure). Raw payloads are NEVER stored — only the sha256 of the
-- normalized input, so the table can't leak scanned PII or replay secrets.
--
-- label_tokens: nonce store for HMAC-signed label tokens
-- (vms.v1.{type}.{id}.{iat}.{exp}.{sig}). A presented token must exist here
-- and be unconsumed. Reprinting a label for an entity consumes the previous
-- token (rotation) — see lib/pdf/label.ts.
--
-- Idempotent so it can run on top of an existing baseline (same convention
-- as 0000_local_auth.sql / scripts/migrate.ts).

CREATE TABLE IF NOT EXISTS public.scan_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Nullable: preserve the event even if the profile is deleted.
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Operator-supplied station/device tag, e.g. "receiving-bay-2".
  device_label TEXT,
  input_type TEXT NOT NULL
    CHECK (input_type IN ('camera', 'hid', 'manual', 'rfid')),
  -- sha256 hex of the NORMALIZED input (control chars stripped, trimmed,
  -- length-capped, case-normalized). Raw payloads are never persisted.
  raw_hash TEXT NOT NULL,
  resolved_entity_type TEXT
    CHECK (resolved_entity_type IN ('product', 'bin', 'take', 'tool')),
  resolved_entity_id UUID,
  -- What happened: resolve | receive | issue | tool_checkout |
  -- tool_return | join_take | set_location.
  action TEXT NOT NULL,
  -- Scan-station / bin location context, e.g. "A-01". Used for the
  -- impossible-velocity anomaly check.
  location_context TEXT,
  -- Anomaly flag (impossible velocity, rate-limit trip, expired/replayed
  -- token, bad checksum). flag_reason carries the detail.
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_created_at
  ON public.scan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_entity
  ON public.scan_events (resolved_entity_type, resolved_entity_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_user
  ON public.scan_events (user_id);

CREATE TABLE IF NOT EXISTS public.label_tokens (
  -- sha256 hex of the complete token string. The signature inside the
  -- token is itself the capability, so we only ever store its hash.
  token_hash TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('product', 'bin', 'take', 'tool')),
  entity_id UUID NOT NULL,
  iat TIMESTAMPTZ NOT NULL,
  exp TIMESTAMPTZ NOT NULL,
  -- Set when the token is retired (rotation on reprint) or revoked.
  consumed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_label_tokens_entity
  ON public.label_tokens (entity_type, entity_id);
