-- 0003_storerooms — storeroom hierarchy + environmental monitoring foundation.
--
-- Adds:
--   * storerooms        — hierarchical rooms (cold, hazmat, quarantine, ...) with
--                         per-room feature toggles + access/allowlist config
--   * bin_locations.room_id — links existing bins (and therefore products via
--                         products.bin_location_id) into a room
--   * sensor_readings   — device telemetry, idempotent on
--                         (room_id, device_id, metric, recorded_at)
--   * alert_rules/alerts — threshold+dwell rules and their lifecycle rows
--
-- Idempotent: safe to re-run on a schema that already has parts applied
-- (IF NOT EXISTS guards + DO-block enum guards), matching the style of
-- 0000_local_auth. Audit triggers reuse audit_trigger_func() from
-- supabase/migrations/002_audit_triggers.sql — sensor_readings deliberately
-- has NO trigger (per-reading audit rows would flood activity_logs); alerts
-- and config tables are audited.

--> statement-breakpoint

-- ============================================================================
-- ENUMS (guarded — CREATE TYPE has no IF NOT EXISTS)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN
    CREATE TYPE room_type AS ENUM (
      'general', 'cold', 'frozen', 'dry', 'it', 'vehicle', 'secure',
      'hazmat', 'quarantine', 'staging', 'dock', 'returns', 'destruction'
    );
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_access_level') THEN
    CREATE TYPE room_access_level AS ENUM ('open', 'restricted', 'secure', 'locked');
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sensor_metric') THEN
    CREATE TYPE sensor_metric AS ENUM (
      'temperature', 'humidity', 'door', 'vibration', 'motion', 'gas'
    );
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_threshold_op') THEN
    CREATE TYPE alert_threshold_op AS ENUM ('above', 'below');
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
    CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_state') THEN
    CREATE TYPE alert_state AS ENUM ('active', 'acknowledged', 'resolved');
  END IF;
END $$;
--> statement-breakpoint

-- ============================================================================
-- STOREROOMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS storerooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type room_type NOT NULL DEFAULT 'general',
  parent_id UUID REFERENCES storerooms(id) ON DELETE SET NULL,
  description TEXT,
  temp_min DECIMAL(8,2),
  temp_max DECIMAL(8,2),
  capacity_units INTEGER,
  access_level room_access_level NOT NULL DEFAULT 'open',
  allowed_roles TEXT[] NOT NULL DEFAULT '{}',
  item_allowlist TEXT[] NOT NULL DEFAULT '{}',
  feature_toggles JSONB NOT NULL DEFAULT '{}',
  quarantine BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_storerooms_parent ON storerooms(parent_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_storerooms_type ON storerooms(type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_storerooms_active ON storerooms(active);
--> statement-breakpoint

DROP TRIGGER IF EXISTS storerooms_audit_trigger ON storerooms;
--> statement-breakpoint
CREATE TRIGGER storerooms_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON storerooms
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
--> statement-breakpoint

-- ============================================================================
-- BIN_LOCATION → ROOM LINKAGE
-- products.bin_location_id already exists; room contents resolve through it.
-- ============================================================================
ALTER TABLE bin_locations
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES storerooms(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bin_locations_room ON bin_locations(room_id);
--> statement-breakpoint

-- ============================================================================
-- SENSOR_READINGS — idempotent device telemetry
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES storerooms(id) ON DELETE CASCADE,
  metric sensor_metric NOT NULL,
  value DECIMAL(15,4) NOT NULL,
  unit TEXT NOT NULL,
  device_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, device_id, metric, recorded_at)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_sensor_readings_room_time
  ON sensor_readings(room_id, recorded_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sensor_readings_metric_time
  ON sensor_readings(metric, recorded_at DESC);
--> statement-breakpoint

-- ============================================================================
-- ALERT_RULES — room+metric threshold with dwell + notify roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES storerooms(id) ON DELETE CASCADE,
  metric sensor_metric NOT NULL,
  op alert_threshold_op NOT NULL,
  threshold DECIMAL(15,4) NOT NULL,
  dwell_minutes INTEGER NOT NULL DEFAULT 0,
  severity alert_severity NOT NULL DEFAULT 'warning',
  notify_roles TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_alert_rules_room ON alert_rules(room_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(active);
--> statement-breakpoint

DROP TRIGGER IF EXISTS alert_rules_audit_trigger ON alert_rules;
--> statement-breakpoint
CREATE TRIGGER alert_rules_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
--> statement-breakpoint

-- ============================================================================
-- ALERTS — lifecycle rows opened by rule evaluation
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  room_id UUID NOT NULL REFERENCES storerooms(id) ON DELETE CASCADE,
  metric sensor_metric NOT NULL,
  value DECIMAL(15,4) NOT NULL,
  state alert_state NOT NULL DEFAULT 'active',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  acked_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_alerts_room ON alerts(room_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_alerts_state ON alerts(state);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_alerts_opened ON alerts(opened_at DESC);
--> statement-breakpoint

-- One live alert per rule — the evaluator also checks, this is the backstop.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_one_open_per_rule
  ON alerts(rule_id)
  WHERE rule_id IS NOT NULL AND state IN ('active', 'acknowledged');
--> statement-breakpoint

DROP TRIGGER IF EXISTS alerts_audit_trigger ON alerts;
--> statement-breakpoint
CREATE TRIGGER alerts_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON alerts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
