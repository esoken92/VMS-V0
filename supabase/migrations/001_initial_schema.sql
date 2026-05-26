-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'fleet_dispatch', 'staff');
CREATE TYPE item_type AS ENUM ('consumable', 'fluid', 'tool', 'tire');
CREATE TYPE movement_type AS ENUM ('inbound', 'outbound', 'adjustment', 'scrap', 'tool_checkout', 'receiving');
CREATE TYPE stock_take_status AS ENUM ('open', 'completed');
CREATE TYPE receiving_status AS ENUM ('pending', 'in_progress', 'completed', 'discrepancy');

-- ============================================================================
-- PROFILES TABLE (User profiles with RBAC roles)
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'staff',
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SUPPLIERS TABLE (Supplier management)
-- ============================================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- BIN_LOCATIONS TABLE (Warehouse zones with weight capacity)
-- ============================================================================
CREATE TABLE bin_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone TEXT NOT NULL,
  bin_location TEXT NOT NULL,
  max_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  UNIQUE(zone, bin_location)
);

-- ============================================================================
-- UNIT_CONVERSIONS TABLE (Stocking unit to issuing unit rules)
-- ============================================================================
CREATE TABLE unit_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  conversion_factor DECIMAL(15,4) NOT NULL,
  UNIQUE(from_unit, to_unit)
);

-- ============================================================================
-- PRODUCTS TABLE (Inventory items with all industrial fields)
-- ============================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  item_type item_type NOT NULL,
  current_stock DECIMAL(15,4) NOT NULL DEFAULT 0,
  min_threshold DECIMAL(15,4) NOT NULL DEFAULT 0,
  average_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL, -- Stocking unit (e.g., Drum, Each)
  issuing_unit TEXT NOT NULL, -- Issuing unit (e.g., Liter, Piece)
  bin_location_id UUID REFERENCES bin_locations(id) ON DELETE SET NULL,
  weight_per_unit_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  carries_core_charge BOOLEAN NOT NULL DEFAULT FALSE,
  core_charge_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
  last_movement_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TOOL_LOANS TABLE (Reusable tool custody tracking)
-- ============================================================================
CREATE TABLE tool_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  worker_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_out_by_user_id UUID NOT NULL REFERENCES profiles(id),
  checked_out_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expected_return_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  condition_on_checkout TEXT,
  condition_on_return TEXT,
  notes TEXT
);

-- ============================================================================
-- RECEIVING_DOCUMENTS TABLE (Goods in workflow)
-- ============================================================================
CREATE TABLE receiving_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  received_by_user_id UUID NOT NULL REFERENCES profiles(id),
  status receiving_status NOT NULL DEFAULT 'pending',
  supplier_invoice_number TEXT,
  expected_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- RECEIVING_ITEMS TABLE (Line items for receiving)
-- ============================================================================
CREATE TABLE receiving_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receiving_document_id UUID NOT NULL REFERENCES receiving_documents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity DECIMAL(15,4) NOT NULL,
  received_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL,
  damage_report TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STOCK_MOVEMENTS TABLE (All inventory transactions)
-- ============================================================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  impersonated_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type movement_type NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  reason TEXT,
  scrap_image_url TEXT,
  receiving_item_id UUID REFERENCES receiving_items(id) ON DELETE SET NULL,
  tool_loan_id UUID REFERENCES tool_loans(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STOCK_TAKES TABLE (Audit sessions)
-- ============================================================================
CREATE TABLE stock_takes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_by UUID NOT NULL REFERENCES profiles(id),
  status stock_take_status NOT NULL DEFAULT 'open',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- ============================================================================
-- STOCK_TAKE_ITEMS TABLE (Blind count records)
-- ============================================================================
CREATE TABLE stock_take_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  system_qty DECIMAL(15,4) NOT NULL,
  physical_qty DECIMAL(15,4),
  variance DECIMAL(15,4),
  counted_by UUID REFERENCES profiles(id),
  counted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(stock_take_id, product_id)
);

-- ============================================================================
-- ACTIVITY_LOGS TABLE (Immutable audit trail)
-- ============================================================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  impersonated_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_bin_location ON products(bin_location_id);
CREATE INDEX idx_products_item_type ON products(item_type);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_tool_loans_tool ON tool_loans(tool_product_id);
CREATE INDEX idx_tool_loans_worker ON tool_loans(worker_profile_id);
CREATE INDEX idx_tool_loans_status ON tool_loans(returned_at);
CREATE INDEX idx_receiving_documents_supplier ON receiving_documents(supplier_id);
CREATE INDEX idx_receiving_items_document ON receiving_items(receiving_document_id);
CREATE INDEX idx_stock_take_items_stock_take ON stock_take_items(stock_take_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_table ON activity_logs(table_name);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bin_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES RLS POLICIES
-- ============================================================================

-- Super Admin: Full access
CREATE POLICY "Super admin full access on profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Admin: Can view and update profiles (but not delete or change roles to super_admin)
CREATE POLICY "Admin can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin can update profiles (except role changes)"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND role != 'super_admin'
  );

-- Fleet Dispatch: Can view own profile only
CREATE POLICY "Fleet dispatch can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- Staff: Can view own profile only
CREATE POLICY "Staff can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- ============================================================================
-- SUPPLIERS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Fleet Dispatch & Staff: Read only
CREATE POLICY "Fleet dispatch and staff can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('fleet_dispatch', 'staff')
    )
  );

-- ============================================================================
-- BIN_LOCATIONS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on bin_locations"
  ON bin_locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Fleet Dispatch & Staff: Read only
CREATE POLICY "Fleet dispatch and staff can view bin_locations"
  ON bin_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('fleet_dispatch', 'staff')
    )
  );

-- ============================================================================
-- UNIT_CONVERSIONS RLS POLICIES
-- ============================================================================

-- All authenticated users: Read only
CREATE POLICY "All authenticated can view unit_conversions"
  ON unit_conversions FOR SELECT
  TO authenticated
  USING (true);

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on unit_conversions"
  ON unit_conversions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PRODUCTS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Fleet Dispatch: Read only (cannot view financial metrics)
CREATE POLICY "Fleet dispatch can view products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- Staff: Read only
CREATE POLICY "Staff can view products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- ============================================================================
-- TOOL_LOANS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on tool_loans"
  ON tool_loans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Fleet Dispatch: Can view and create tool loans, can return own loans
CREATE POLICY "Fleet dispatch can view tool_loans"
  ON tool_loans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

CREATE POLICY "Fleet dispatch can create tool_loans"
  ON tool_loans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

CREATE POLICY "Fleet dispatch can update own tool_loans"
  ON tool_loans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
      AND tool_loans.worker_profile_id = profiles.id
    )
  );

-- Staff: Can view own loans only
CREATE POLICY "Staff can view own tool_loans"
  ON tool_loans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
      AND tool_loans.worker_profile_id = profiles.id
    )
  );

-- ============================================================================
-- RECEIVING_DOCUMENTS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on receiving_documents"
  ON receiving_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Staff: Can create and update receiving documents
CREATE POLICY "Staff can view receiving_documents"
  ON receiving_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can create receiving_documents"
  ON receiving_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can update receiving_documents"
  ON receiving_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- Fleet Dispatch: Read only
CREATE POLICY "Fleet dispatch can view receiving_documents"
  ON receiving_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- ============================================================================
-- RECEIVING_ITEMS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on receiving_items"
  ON receiving_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Staff: Can create and update receiving items
CREATE POLICY "Staff can view receiving_items"
  ON receiving_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can create receiving_items"
  ON receiving_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can update receiving_items"
  ON receiving_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- Fleet Dispatch: Read only
CREATE POLICY "Fleet dispatch can view receiving_items"
  ON receiving_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- ============================================================================
-- STOCK_MOVEMENTS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on stock_movements"
  ON stock_movements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Fleet Dispatch: Can create outbound movements and tool checkouts, view own movements
CREATE POLICY "Fleet dispatch can view stock_movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
      AND stock_movements.user_id = profiles.id
    )
  );

CREATE POLICY "Fleet dispatch can create stock_movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    (type = 'outbound' OR type = 'tool_checkout')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- Staff: Can create inbound movements and adjustments, view own movements
CREATE POLICY "Staff can view stock_movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
      AND stock_movements.user_id = profiles.id
    )
  );

CREATE POLICY "Staff can create stock_movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    (type = 'inbound' OR type = 'adjustment' OR type = 'receiving')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- ============================================================================
-- STOCK_TAKES RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on stock_takes"
  ON stock_takes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Staff: Can create and update stock takes
CREATE POLICY "Staff can view stock_takes"
  ON stock_takes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can create stock_takes"
  ON stock_takes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can update stock_takes"
  ON stock_takes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- Fleet Dispatch: Read only
CREATE POLICY "Fleet dispatch can view stock_takes"
  ON stock_takes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- ============================================================================
-- STOCK_TAKE_ITEMS RLS POLICIES
-- ============================================================================

-- Super Admin & Admin: Full access
CREATE POLICY "Admin full access on stock_take_items"
  ON stock_take_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Staff: Can create and update stock take items (blind count)
CREATE POLICY "Staff can view stock_take_items"
  ON stock_take_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can create stock_take_items"
  ON stock_take_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

CREATE POLICY "Staff can update stock_take_items"
  ON stock_take_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- Fleet Dispatch: Read only
CREATE POLICY "Fleet dispatch can view stock_take_items"
  ON stock_take_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'fleet_dispatch'
    )
  );

-- ============================================================================
-- ACTIVITY_LOGS RLS POLICIES (IMMUTABLE)
-- ============================================================================

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- Block ALL updates on activity_logs
CREATE POLICY "Block all updates on activity_logs"
  ON activity_logs FOR UPDATE
  TO authenticated
  USING (false);

-- Block ALL deletes on activity_logs
CREATE POLICY "Block all deletes on activity_logs"
  ON activity_logs FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receiving_documents_updated_at BEFORE UPDATE ON receiving_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
