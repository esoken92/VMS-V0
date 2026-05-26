-- RPC Functions for Complex Transactions
-- These functions handle multi-step operations that need to be atomic

-- Function: Record stock movement with automatic product stock update
CREATE OR REPLACE FUNCTION record_stock_movement(
  p_product_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT,
  p_scrap_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_new_stock INTEGER;
  v_movement_id UUID;
BEGIN
  -- Get current product stock
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;
  
  -- Calculate new stock
  IF p_type = 'inbound' THEN
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
  VALUES (p_product_id, p_user_id, p_type, 
          CASE WHEN p_type = 'inbound' THEN ABS(p_quantity) ELSE -ABS(p_quantity) END,
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
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_take RECORD;
  v_total_variance INTEGER;
BEGIN
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
      completed_by = p_user_id,
      notes = p_notes,
      total_variance = v_total_variance
  WHERE id = p_stock_take_id;
  
  -- Optionally update product stocks based on physical counts
  -- This can be enabled/disabled based on business requirements
  -- FOR item IN SELECT * FROM stock_take_items WHERE stock_take_id = p_stock_take_id LOOP
  --   UPDATE products SET current_stock = item.physical_qty WHERE id = item.product_id;
  -- END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_variance', v_total_variance
  );
END;
$$;

-- Function: Check out tool with validation
CREATE OR REPLACE FUNCTION check_out_tool(
  p_product_id UUID,
  p_user_id UUID,
  p_checked_out_by UUID,
  p_condition_out TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_active_loans INTEGER;
  v_loan_id UUID;
BEGIN
  -- Get product details
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;
  
  IF v_product.item_type != 'tool' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product is not a tool');
  END IF;
  
  -- Check if tool is already checked out
  SELECT COUNT(*) INTO v_active_loans
  FROM tool_loans
  WHERE product_id = p_product_id AND returned_at IS NULL;
  
  IF v_active_loans > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tool is already checked out');
  END IF;
  
  -- Insert tool loan
  INSERT INTO tool_loans (product_id, user_id, checked_out_by, condition_out, notes)
  VALUES (p_product_id, p_user_id, p_checked_out_by, p_condition_out, p_notes)
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
  p_returned_by UUID,
  p_condition_in TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan RECORD;
BEGIN
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
      returned_by = p_returned_by,
      condition_in = p_condition_in
  WHERE id = p_loan_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function: Get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  id UUID,
  sku TEXT,
  name TEXT,
  current_stock INTEGER,
  min_threshold INTEGER,
  variance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
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
CREATE OR REPLACE FUNCTION get_product_movement_history(
  p_product_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  quantity INTEGER,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
GRANT EXECUTE ON FUNCTION record_stock_movement TO authenticated;
GRANT EXECUTE ON FUNCTION complete_stock_take TO authenticated;
GRANT EXECUTE ON FUNCTION check_out_tool TO authenticated;
GRANT EXECUTE ON FUNCTION return_tool TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_movement_history TO authenticated;
