-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- This function captures all data changes into the activity_logs table
-- for immutable audit trail with impersonation tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  impersonated_by UUID;
BEGIN
  -- Get current user ID from JWT claim or auth.uid()
  current_user_id := COALESCE(
    current_setting('request.jwt.claim.sub', true)::uuid,
    auth.uid()
  );
  
  -- Get impersonated user ID from app setting (if set)
  impersonated_by := NULLIF(
    current_setting('app.impersonated_by', true)::text,
    ''
  )::uuid;
  
  -- Insert audit record
  INSERT INTO activity_logs (
    user_id,
    impersonated_by_user_id,
    action_type,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    current_user_id,
    impersonated_by,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) 
      ELSE NULL 
    END,
    CASE 
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) 
      ELSE NULL 
    END,
    current_setting('request.headers.x-client-ip', true),
    current_setting('request.headers.x-user-agent', true)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- APPLY TRIGGERS TO CORE TABLES
-- ============================================================================

-- Products table trigger
DROP TRIGGER IF EXISTS products_audit_trigger ON products;
CREATE TRIGGER products_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Stock movements table trigger
DROP TRIGGER IF EXISTS stock_movements_audit_trigger ON stock_movements;
CREATE TRIGGER stock_movements_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Tool loans table trigger
DROP TRIGGER IF EXISTS tool_loans_audit_trigger ON tool_loans;
CREATE TRIGGER tool_loans_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tool_loans
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Stock take items table trigger
DROP TRIGGER IF EXISTS stock_take_items_audit_trigger ON stock_take_items;
CREATE TRIGGER stock_take_items_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON stock_take_items
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Receiving documents table trigger
DROP TRIGGER IF EXISTS receiving_documents_audit_trigger ON receiving_documents;
CREATE TRIGGER receiving_documents_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON receiving_documents
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Receiving items table trigger
DROP TRIGGER IF EXISTS receiving_items_audit_trigger ON receiving_items;
CREATE TRIGGER receiving_items_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON receiving_items
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Profiles table trigger (for user management)
DROP TRIGGER IF EXISTS profiles_audit_trigger ON profiles;
CREATE TRIGGER profiles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Suppliers table trigger
DROP TRIGGER IF EXISTS suppliers_audit_trigger ON suppliers;
CREATE TRIGGER suppliers_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Bin locations table trigger
DROP TRIGGER IF EXISTS bin_locations_audit_trigger ON bin_locations;
CREATE TRIGGER bin_locations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bin_locations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Unit conversions table trigger
DROP TRIGGER IF EXISTS unit_conversions_audit_trigger ON unit_conversions;
CREATE TRIGGER unit_conversions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON unit_conversions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Stock takes table trigger
DROP TRIGGER IF EXISTS stock_takes_audit_trigger ON stock_takes;
CREATE TRIGGER stock_takes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON stock_takes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- UTILITY FUNCTION: Calculate Moving Average Cost
-- Updates product average_cost based on stock movements
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_moving_average_cost(p_product_id UUID)
RETURNS DECIMAL(15,4) AS $$
DECLARE
  total_cost DECIMAL(15,4);
  total_quantity DECIMAL(15,4);
  new_average_cost DECIMAL(15,4);
BEGIN
  -- Calculate total cost and quantity from inbound movements
  SELECT 
    COALESCE(SUM(sm.quantity * p.average_cost), 0),
    COALESCE(SUM(sm.quantity), 0)
  INTO total_cost, total_quantity
  FROM stock_movements sm
  JOIN products p ON sm.product_id = p.id
  WHERE sm.product_id = p_product_id
  AND sm.type IN ('inbound', 'receiving');
  
  -- Calculate new average cost
  IF total_quantity > 0 THEN
    new_average_cost := total_cost / total_quantity;
  ELSE
    -- If no inbound movements, keep existing average cost
    SELECT average_cost INTO new_average_cost
    FROM products
    WHERE id = p_product_id;
  END IF;
  
  -- Update product with new average cost
  UPDATE products
  SET average_cost = new_average_cost
  WHERE id = p_product_id;
  
  RETURN new_average_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY FUNCTION: Check Bin Weight Capacity
-- Validates that adding items won't exceed bin weight limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_bin_weight_capacity(
  p_bin_location_id UUID,
  p_additional_weight DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  max_weight DECIMAL(10,2);
  current_weight DECIMAL(10,2);
  total_weight DECIMAL(10,2);
BEGIN
  -- Get bin max weight capacity
  SELECT max_weight_kg INTO max_weight
  FROM bin_locations
  WHERE id = p_bin_location_id;
  
  -- Calculate current weight in bin
  SELECT COALESCE(SUM(p.weight_per_unit_kg * p.current_stock), 0)
  INTO current_weight
  FROM products p
  WHERE p.bin_location_id = p_bin_location_id;
  
  -- Calculate total weight after addition
  total_weight := current_weight + p_additional_weight;
  
  -- Return true if within capacity, false if over capacity
  RETURN total_weight <= max_weight;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY FUNCTION: Generate Optimized Pick Route
-- Returns items sorted by zone and bin_location for efficient picking
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_optimized_pick_route(p_stock_take_id UUID)
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  zone TEXT,
  bin_location TEXT,
  quantity DECIMAL(15,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.sku,
    p.name,
    bl.zone,
    bl.bin_location,
    sti.physical_qty
  FROM stock_take_items sti
  JOIN products p ON sti.product_id = p.id
  LEFT JOIN bin_locations bl ON p.bin_location_id = bl.id
  WHERE sti.stock_take_id = p_stock_take_id
  ORDER BY 
    bl.zone ASC,
    bl.bin_location ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update Product Last Movement Date
-- Automatically updates last_movement_date when stock movement occurs
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_last_movement_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET last_movement_date = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_product_last_movement ON stock_movements;
CREATE TRIGGER update_product_last_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_last_movement_date();

-- ============================================================================
-- TRIGGER: Update Product Current Stock
-- Automatically adjusts current_stock based on stock movements
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_current_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('inbound', 'receiving') THEN
    -- Add to stock
    UPDATE products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.type IN ('outbound', 'scrap', 'tool_checkout') THEN
    -- Subtract from stock
    UPDATE products
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.type = 'adjustment' THEN
    -- Set to new value (adjustment should contain the delta)
    UPDATE products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_product_current_stock ON stock_movements;
CREATE TRIGGER update_product_current_stock
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_current_stock();

-- ============================================================================
-- FUNCTION: Set Impersonation Context
-- Used by application to set impersonation context for audit trail
-- ============================================================================

CREATE OR REPLACE FUNCTION set_impersonation_context(p_impersonated_by UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.impersonated_by', p_impersonated_by::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Clear Impersonation Context
-- Used by application to clear impersonation context
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_impersonation_context()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.impersonated_by', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
