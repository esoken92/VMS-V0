-- Add manager role to user_role enum
ALTER TYPE user_role ADD VALUE 'manager' BEFORE 'admin';

-- Update RLS policies to match permissions matrix

-- ============================================================================
-- PRODUCTS RLS POLICIES - Updated for manager role
-- ============================================================================

-- Manager: Can add/edit products (but not delete)
CREATE POLICY "Manager can view products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- ============================================================================
-- SUPPLIERS RLS POLICIES - Updated for manager role
-- ============================================================================

-- Manager: Can add/edit suppliers (but not delete)
CREATE POLICY "Manager can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- ============================================================================
-- BIN_LOCATIONS RLS POLICIES - Updated for manager role
-- ============================================================================

-- Manager: Read only (cannot edit bin capacities)
CREATE POLICY "Manager can view bin_locations"
  ON bin_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- ============================================================================
-- STOCK_TAKES RLS POLICIES - Updated for manager role
-- ============================================================================

-- Manager: Can manage and approve stock takes
CREATE POLICY "Manager can view stock_takes"
  ON stock_takes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can insert stock_takes"
  ON stock_takes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can update stock_takes"
  ON stock_takes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- ============================================================================
-- TOOL_LOANS RLS POLICIES - Updated for manager role
-- ============================================================================

-- Manager: Can approve tool loans
CREATE POLICY "Manager can view tool_loans"
  ON tool_loans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can insert tool_loans"
  ON tool_loans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Manager can update tool_loans"
  ON tool_loans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- ============================================================================
-- ACTIVITY_LOGS RLS POLICIES - Updated for manager role
-- ============================================================================

-- Manager: Cannot view financial/audit reports (read-only on basic logs)
-- Keep existing policy: All authenticated users can read basic logs
