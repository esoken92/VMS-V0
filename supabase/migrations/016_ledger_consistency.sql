-- 016 — ledger consistency: custody legs vs stock, replay idempotency
--   * tool_checkout is a CUSTODY audit record (sign of quantity = direction
--     out/in; custody itself lives on tool_loans). It never changes
--     products.current_stock and never moves the per-bin projection.
--     The product_stock trigger therefore skips it.
--   * stock_movements.client_ref — caller-supplied idempotency key for
--     replayed writes (the offline scan queue retries through
--     POST /api/v1/movements); unique when present, so a lost response
--     followed by a retry cannot double-post the same movement.

CREATE OR REPLACE FUNCTION product_stock_projection() RETURNS trigger AS $$
DECLARE v_bin uuid;
BEGIN
  -- Custody audit legs are not stock events: a checked-out tool stays on
  -- the owner's books, it does not move between bins.
  IF NEW.type = 'tool_checkout' THEN
    RETURN NEW;
  END IF;
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

-- Repair: undo any bin projection previously decremented by custody legs.
WITH legs AS (
  SELECT m.product_id,
         COALESCE(m.bin_location_id, p.bin_location_id) AS bin,
         m.quantity
  FROM stock_movements m
  JOIN products p ON p.id = m.product_id
  WHERE m.type = 'tool_checkout'
), adj AS (
  SELECT product_id, bin, SUM(quantity) AS applied
  FROM legs WHERE bin IS NOT NULL
  GROUP BY product_id, bin
)
UPDATE product_stock ps
SET quantity = ps.quantity - adj.applied, updated_at = NOW()
FROM adj
WHERE ps.product_id = adj.product_id AND ps.bin_location_id = adj.bin;
--> statement-breakpoint

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS client_ref text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_movements_client_ref
  ON stock_movements(client_ref) WHERE client_ref IS NOT NULL;
