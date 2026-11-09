-- RPC Functions for Complex Transactions
-- These functions handle multi-step operations that need to be atomic
--
-- SECURITY MODEL
-- ==============
-- SECURITY DEFINER functions bypass RLS. Write functions here are DEFINER
-- because legitimate flows (e.g. a picker recording a movement) touch rows
-- their role cannot update directly (products.current_stock). Actor columns
-- are ALWAYS set from auth.uid() inside the function — never trusted from
-- caller parameters — and search_path is pinned. Read helpers that can rely
-- on RLS use SECURITY INVOKER.

-- Function: Record stock movement with automatic product stock update
CREATE OR REPLACE FUNCTION record_stock_movement(
  p_product_id UUID,
  p_type movement_type,
  p_quantity DECIMAL(15,4),
  p_reason TEXT,
  p_scrap_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_new_stock DECIMAL(15,4);
  v_movement_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be positive');
  END IF;

  -- Get current product stock
  SELECT * INTO v_product FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  -- Calculate new stock
  IF p_type IN ('inbound', 'receiving', 'adjustment') THEN
    v_new_stock := v_product.current_stock + ABS(p_quantity);
  ELSE
    v_new_stock := v_product.current_stock - ABS(p_quantity);
  END IF;

  -- Validate stock doesn't go negative
  IF v_new_stock < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock');
  END IF;

  -- Insert stock movement
  INSERT INTO stock_movements (product_id, user_id, type, quantity, reason, scrap_image_url)
  VALUES (p_product_id, auth.uid(), p_type,
          CASE WHEN p_type IN ('inbound', 'receiving', 'adjustment') THEN ABS(p_quantity) ELSE -ABS(p_quantity) END,
          p_reason, p_scrap_image_url)
  RETURNING id INTO v_movement_id;

  -- Update product stock
  UPDATE products
  SET current_stock = v_new_stock,
      last_movement_date = NOW()
  WHERE id = p_product_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'new_stock', v_new_stock
  );
END;
$$;

-- Function: Complete stock take with variance calculation
CREATE OR REPLACE FUNCTION complete_stock_take(
  p_stock_take_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_take RECORD;
  v_total_variance DECIMAL(15,4);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get stock take details
  SELECT * INTO v_stock_take FROM stock_takes WHERE id = p_stock_take_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock take not found');
  END IF;

  IF v_stock_take.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock take is not open');
  END IF;

  -- Calculate total variance
  SELECT COALESCE(SUM(variance), 0) INTO v_total_variance
  FROM stock_take_items
  WHERE stock_take_id = p_stock_take_id;

  -- Update stock take status
  UPDATE stock_takes
  SET status = 'completed',
      completed_at = NOW(),
      notes = COALESCE(p_notes, notes)
  WHERE id = p_stock_take_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_variance', v_total_variance
  );
END;
$$;

-- Function: Check out tool with validation
-- p_worker_profile_id defaults to the caller (self-checkout); a
-- fleet_dispatch/admin may check a tool out on behalf of another profile.
CREATE OR REPLACE FUNCTION check_out_tool(
  p_tool_product_id UUID,
  p_condition_on_checkout TEXT,
  p_expected_return_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_worker_profile_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_active_loans INTEGER;
  v_loan_id UUID;
  v_worker_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_worker_id := COALESCE(p_worker_profile_id, auth.uid());

  -- Checking a tool out for someone else requires a supervisor role
  IF v_worker_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('fleet_dispatch', 'manager', 'admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_privilege: cannot check out a tool for another user');
  END IF;

  -- Get product details
  SELECT * INTO v_product FROM products WHERE id = p_tool_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF v_product.item_type != 'tool' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product is not a tool');
  END IF;

  -- Check if tool is already checked out
  SELECT COUNT(*) INTO v_active_loans
  FROM tool_loans
  WHERE tool_product_id = p_tool_product_id AND returned_at IS NULL;

  IF v_active_loans > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tool is already checked out');
  END IF;

  -- Insert tool loan
  INSERT INTO tool_loans (tool_product_id, worker_profile_id, checked_out_by_user_id, expected_return_at, condition_on_checkout, notes)
  VALUES (p_tool_product_id, v_worker_id, auth.uid(), p_expected_return_at, p_condition_on_checkout, p_notes)
  RETURNING id INTO v_loan_id;

  RETURN jsonb_build_object(
    'success', true,
    'loan_id', v_loan_id
  );
END;
$$;

-- Function: Return tool with condition update
CREATE OR REPLACE FUNCTION return_tool(
  p_loan_id UUID,
  p_condition_on_return TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get loan details
  SELECT * INTO v_loan FROM tool_loans WHERE id = p_loan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF v_loan.returned_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tool has already been returned');
  END IF;

  -- Update loan
  UPDATE tool_loans
  SET returned_at = NOW(),
      condition_on_return = p_condition_on_return
  WHERE id = p_loan_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function: Get low stock products
-- INVOKER: every role can read products, RLS applies normally.
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  id UUID,
  sku TEXT,
  name TEXT,
  current_stock DECIMAL(15,4),
  min_threshold DECIMAL(15,4),
  variance DECIMAL(15,4)
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.sku,
    p.name,
    p.current_stock,
    p.min_threshold,
    p.current_stock - p.min_threshold as variance
  FROM products p
  WHERE p.current_stock <= p.min_threshold
  ORDER BY (p.current_stock - p.min_threshold) ASC;
END;
$$;

-- Function: Get product movement history
-- DEFINER so actor names resolve for all roles (profiles RLS otherwise
-- limits each user to their own row).
CREATE OR REPLACE FUNCTION get_product_movement_history(
  p_product_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  type movement_type,
  quantity DECIMAL(15,4),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.type,
    sm.quantity,
    sm.reason,
    sm.created_at,
    pr.full_name as user_name
  FROM stock_movements sm
  LEFT JOIN profiles pr ON sm.user_id = pr.id
  WHERE sm.product_id = p_product_id
    AND sm.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY sm.created_at DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION record_stock_movement(UUID, movement_type, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_stock_take(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_out_tool(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION return_tool(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_products() TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_movement_history(UUID, INTEGER) TO authenticated;
