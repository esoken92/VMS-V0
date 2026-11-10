-- 014_transfers_kits — per-bin stock projection, transfer documents, kit BOMs.
--
-- Model:
--   * product_stock(product_id, bin_location_id, quantity) is a PROJECTION
--     maintained by trigger from stock_movements — never written directly.
--     Every movement leg may pin bin_location_id; NULL falls back to the
--     product's home bin (products.bin_location_id), so stock can never be
--     orphaned by a leg that forgot its bin. If the product has no home bin
--     the leg simply isn't projected (stock is "unlocated" — verify-ledger
--     reports the located/unlocated split per product).
--   * A transfer is a document (draft → dispatched → received | cancelled)
--     with chain-of-custody signers. Dispatch writes a -qty 'transfer' leg at
--     the source bin; receive writes a +qty 'transfer' leg at the destination.
--     Product-level current_stock nets to zero — the ledger invariant holds —
--     while the per-bin projection shows stock leave one bin and arrive at the
--     other (in-transit = dispatched-but-not-received).
--   * Kits are products with a BOM in product_components. Assemble writes
--     'kit_consume' legs on components and a 'kit_produce' leg on the kit,
--     one transaction; disassemble reverses.
--
-- Idempotent (IF NOT EXISTS / DO guards) matching 0000_local_auth style.
-- Audit triggers reuse audit_trigger_func() — product_stock deliberately has
-- NO trigger (it's a projection; churn rows would flood activity_logs).

--> statement-breakpoint

-- ============================================================================
-- ENUM EXTENSIONS
-- ============================================================================
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer';
--> statement-breakpoint
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'kit_consume';
--> statement-breakpoint
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'kit_produce';
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
    CREATE TYPE transfer_status AS ENUM ('draft', 'dispatched', 'received', 'cancelled');
  END IF;
END $$;
--> statement-breakpoint

-- ============================================================================
-- STOCK_MOVEMENT LEG COLUMNS — which bin did this leg touch + transfer link
-- ============================================================================
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS transfer_item_id UUID;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_movements_bin ON stock_movements(bin_location_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_movements_transfer_item ON stock_movements(transfer_item_id);
--> statement-breakpoint

-- ============================================================================
-- PRODUCT_STOCK — per-bin quantity projection (trigger-maintained)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_stock (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bin_location_id UUID NOT NULL REFERENCES bin_locations(id) ON DELETE CASCADE,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, bin_location_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_product_stock_bin ON product_stock(bin_location_id);
--> statement-breakpoint

-- Backfill: existing stock sits at each product's home bin.
INSERT INTO product_stock (product_id, bin_location_id, quantity, updated_at)
SELECT id, bin_location_id, current_stock, NOW()
FROM products
WHERE bin_location_id IS NOT NULL AND current_stock <> 0
ON CONFLICT (product_id, bin_location_id) DO NOTHING;
--> statement-breakpoint

-- Projection trigger — the ONLY writer to product_stock.
CREATE OR REPLACE FUNCTION product_stock_projection() RETURNS trigger AS $$
DECLARE v_bin uuid;
BEGIN
  v_bin := NEW.bin_location_id;
  IF v_bin IS NULL THEN
    SELECT bin_location_id INTO v_bin FROM products WHERE id = NEW.product_id;
  END IF;
  IF v_bin IS NULL THEN
    RETURN NEW; -- product has no home bin — leg is "unlocated" by design
  END IF;
  -- UPDATE first: INSERT ... ON CONFLICT would speculatively insert the
  -- negative quantity and trip the CHECK before the arbiter can merge it.
  UPDATE product_stock
  SET quantity = quantity + NEW.quantity, updated_at = NOW()
  WHERE product_id = NEW.product_id AND bin_location_id = v_bin;
  IF NOT FOUND THEN
    IF NEW.quantity < 0 THEN
      RAISE EXCEPTION 'Cannot draw % from empty bin % for product %',
        -NEW.quantity, v_bin, NEW.product_id;
    END IF;
    INSERT INTO product_stock (product_id, bin_location_id, quantity, updated_at)
    VALUES (NEW.product_id, v_bin, NEW.quantity, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS stock_movements_product_stock_trg ON stock_movements;
--> statement-breakpoint
CREATE TRIGGER stock_movements_product_stock_trg
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION product_stock_projection();
--> statement-breakpoint

-- ============================================================================
-- IN-TRANSIT SYSTEM BIN — the real location stock sits in between dispatch
-- and receive, so transfer pairs never leave the ledger unbalanced. It is
-- movement-only: products should never use it as their home bin.
-- ============================================================================
INSERT INTO bin_locations (zone, bin_location, max_weight_kg, description)
SELECT 'In Transit', 'IN-TRANSIT', 0, 'System location — stock in transit between bins'
WHERE NOT EXISTS (
  SELECT 1 FROM bin_locations WHERE zone = 'In Transit' AND bin_location = 'IN-TRANSIT'
);
--> statement-breakpoint

-- ============================================================================
-- TRANSFERS — document + items + chain of custody
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS transfer_number_seq START 1;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number TEXT NOT NULL UNIQUE
    DEFAULT ('TRF-' || lpad(nextval('transfer_number_seq')::text, 6, '0')),
  status transfer_status NOT NULL DEFAULT 'draft',
  from_bin_location_id UUID NOT NULL REFERENCES bin_locations(id),
  to_bin_location_id UUID NOT NULL REFERENCES bin_locations(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  dispatched_by UUID REFERENCES profiles(id),
  dispatched_at TIMESTAMPTZ,
  received_by UUID REFERENCES profiles(id),
  received_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_bin_location_id <> to_bin_location_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_bin_location_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_bin_location_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(15,4) NOT NULL CHECK (quantity > 0),
  dispatched_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  received_quantity DECIMAL(15,4) NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON transfer_items(product_id);
--> statement-breakpoint

-- FK from movement legs to the transfer item that caused them (post-table so
-- the column exists before the constraint).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_transfer_item_fk'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_transfer_item_fk
      FOREIGN KEY (transfer_item_id) REFERENCES transfer_items(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS transfers_audit_trigger ON transfers;
--> statement-breakpoint
CREATE TRIGGER transfers_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transfers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
--> statement-breakpoint
DROP TRIGGER IF EXISTS transfer_items_audit_trigger ON transfer_items;
--> statement-breakpoint
CREATE TRIGGER transfer_items_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transfer_items
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
--> statement-breakpoint

-- ============================================================================
-- PRODUCT_COMPONENTS — kit bill of materials
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(15,4) NOT NULL CHECK (quantity > 0),
  UNIQUE (kit_product_id, component_product_id),
  CHECK (kit_product_id <> component_product_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_product_components_component
  ON product_components(component_product_id);
--> statement-breakpoint

DROP TRIGGER IF EXISTS product_components_audit_trigger ON product_components;
--> statement-breakpoint
CREATE TRIGGER product_components_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_components
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
