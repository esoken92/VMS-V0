-- 0004_instance_config — deployment-level key/value configuration.
--
-- Adds:
--   * instance_config — generic JSONB config store keyed by `key`. The
--     setup wizard writes a single row under key 'provisioning'; other
--     keys are free for future deployment settings (e.g. the per-product
--     tracking-attribute rows the wizard's feature flags drive).
--
-- Idempotent: safe to re-run on a schema that already has it applied
-- (IF NOT EXISTS guard), matching the style of 0003_storerooms.
-- Audit trigger reuses audit_trigger_func() from
-- supabase/migrations/002_audit_triggers.sql — every config write lands
-- in activity_logs with the actor set via setAuditContext().
--> statement-breakpoint

-- ============================================================================
-- INSTANCE_CONFIG
-- ============================================================================
CREATE TABLE IF NOT EXISTS instance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);
--> statement-breakpoint

DROP TRIGGER IF EXISTS instance_config_audit_trigger ON instance_config;
--> statement-breakpoint
CREATE TRIGGER instance_config_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON instance_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
--> statement-breakpoint

-- ============================================================================
-- SEEDABLE DEFAULTS
-- Deliberately commented out: the ABSENCE of a 'provisioning' row is what
-- marks the instance as unprovisioned and drives the "Finish setup" banner.
-- A deployment that wants to skip the wizard can seed its own row, e.g.:
--
--   INSERT INTO instance_config (key, value) VALUES
--     ('provisioning', '{
--       "v": 1,
--       "industries": ["general_retail"],
--       "packs": ["stock_control"],
--       "stock": {"perishable": false, "serialized": false, "hazmat": false,
--                 "tools_loanable": false, "vehicle_parts": false,
--                 "consumables": true},
--       "policies": {"picking_strategy": "fifo",
--                    "picking_enforcement": "suggest",
--                    "valuation_method": "weighted_average",
--                    "expiry_policy": "none"},
--       "applied_at": "2024-01-01T00:00:00.000Z"
--     }'::jsonb)
--   ON CONFLICT (key) DO NOTHING;
