-- ============================================================================
-- VMS Demo Seed Data
-- ============================================================================
-- OPTIONAL demo dataset: 4 demo accounts (one per role) + sample inventory.
--
-- SECURITY NOTE: these are well-known credentials for local/demo use only.
-- Do NOT run this seed on any environment you consider sensitive.
--
-- Run with:  npm run db:seed     (scripts/seed.ts executes this file, then
--                                sets argon2id password hashes — see below)
-- ============================================================================

-- ============================================================================
-- DEMO USERS
-- ============================================================================
-- The app and RLS policies treat profiles.id = auth.users.id (1:1 identity),
-- so the profile PK is intentionally the same UUID as the auth user.
--
-- Passwords are NOT stored here: auth is app-managed (Auth.js credentials
-- provider) and verifies argon2id hashes in profiles.password_hash.
-- scripts/seed.ts sets those hashes after running this file. Plain SQL cannot
-- produce argon2, so this file only creates the identity rows.

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'demo.admin@vms-demo.com',   '', NOW()),
  ('a0000000-0000-4000-8000-000000000002', 'demo.manager@vms-demo.com', '', NOW()),
  ('a0000000-0000-4000-8000-000000000003', 'demo.fleet@vms-demo.com',   '', NOW()),
  ('a0000000-0000-4000-8000-000000000004', 'demo.worker@vms-demo.com',  '', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, user_id, full_name, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Demo Admin',          'super_admin'),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Demo Manager',        'manager'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'Demo Fleet Dispatch', 'fleet_dispatch'),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'Demo Worker',         'staff')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- ============================================================================
-- BIN LOCATIONS
-- ============================================================================
INSERT INTO bin_locations (zone, bin_location, max_weight_kg, description) VALUES
('Zone A', 'A1', 500.00, 'Small parts storage'),
('Zone A', 'A2', 500.00, 'Small parts storage'),
('Zone A', 'A3', 500.00, 'Small parts storage'),
('Zone A', 'A4', 500.00, 'Small parts storage'),
('Zone A', 'A5', 500.00, 'Small parts storage'),
('Zone A', 'A6', 500.00, 'Small parts storage'),
('Zone A', 'A7', 500.00, 'Small parts storage'),
('Zone A', 'A8', 500.00, 'Small parts storage'),
('Zone A', 'A9', 500.00, 'Small parts storage'),
('Zone A', 'A10', 500.00, 'Small parts storage'),
('Zone B', 'B1', 1000.00, 'Medium parts storage'),
('Zone B', 'B2', 1000.00, 'Medium parts storage'),
('Zone B', 'B3', 1000.00, 'Medium parts storage'),
('Zone B', 'B4', 1000.00, 'Medium parts storage'),
('Zone B', 'B5', 1000.00, 'Medium parts storage'),
('Zone B', 'B6', 1000.00, 'Medium parts storage'),
('Zone B', 'B7', 1000.00, 'Medium parts storage'),
('Zone B', 'B8', 1000.00, 'Medium parts storage'),
('Zone B', 'B9', 1000.00, 'Medium parts storage'),
('Zone B', 'B10', 1000.00, 'Medium parts storage'),
('Zone C', 'C1', 2000.00, 'Large parts and tools'),
('Zone C', 'C2', 2000.00, 'Large parts and tools'),
('Zone C', 'C3', 2000.00, 'Large parts and tools'),
('Zone C', 'C4', 2000.00, 'Large parts and tools'),
('Zone C', 'C5', 2000.00, 'Large parts and tools'),
('Zone C', 'C6', 2000.00, 'Large parts and tools'),
('Zone C', 'C7', 2000.00, 'Large parts and tools'),
('Zone C', 'C8', 2000.00, 'Large parts and tools'),
('Zone C', 'C9', 2000.00, 'Large parts and tools'),
('Zone C', 'C10', 2000.00, 'Large parts and tools')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
INSERT INTO suppliers (name, contact_email, phone, address) VALUES
('AutoParts Direct', 'orders@autopartsdirect.com', '+1-555-0101', '123 Industrial Blvd, Detroit, MI 48201'),
('ToolMaster Supply', 'sales@toolmaster.com', '+1-555-0102', '456 Tool Lane, Chicago, IL 60601'),
('Fluid Dynamics Inc', 'info@fluiddynamics.com', '+1-555-0103', '789 Fluid Way, Houston, TX 77001'),
('Tire Kingdom', 'orders@tirekingdom.com', '+1-555-0104', '321 Rubber St, Akron, OH 44301'),
('QuickShip Parts', 'support@quickship.com', '+1-555-0105', '654 Speed Ave, Memphis, TN 38101'),
('Industrial Supplies Co', 'sales@industrial.com', '+1-555-0106', '987 Factory Rd, Pittsburgh, PA 15201'),
('Global Hardware', 'orders@globalhardware.com', '+1-555-0107', '147 Hardware Blvd, Seattle, WA 98101'),
('Safety First Gear', 'info@safetyfirst.com', '+1-555-0108', '258 Safety Dr, Los Angeles, CA 90001');

-- ============================================================================
-- PRODUCTS
-- ============================================================================
INSERT INTO products (sku, name, item_type, current_stock, min_threshold, unit_of_measure, issuing_unit, bin_location_id, supplier_id, average_cost, last_movement_date) VALUES
-- Consumables
('BRK-001', 'Brake Pads - Front', 'consumable', 150, 20, 'Pair', 'Pair', (SELECT id FROM bin_locations WHERE bin_location = 'A1'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 25.00, NOW()),
('BRK-002', 'Brake Pads - Rear', 'consumable', 120, 20, 'Pair', 'Pair', (SELECT id FROM bin_locations WHERE bin_location = 'A2'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 25.00, NOW()),
('FLT-001', 'Oil Filter - Standard', 'consumable', 200, 30, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'A3'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 8.00, NOW()),
('FLT-002', 'Oil Filter - Premium', 'consumable', 80, 15, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'A4'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 15.00, NOW()),
('AIR-001', 'Air Filter', 'consumable', 180, 25, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'A5'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 12.00, NOW()),
('CAB-001', 'Cabin Air Filter', 'consumable', 90, 15, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'A6'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 10.00, NOW()),
('SPK-001', 'Spark Plug - Standard', 'consumable', 300, 50, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'A7'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 5.00, NOW()),
('SPK-002', 'Spark Plug - Platinum', 'consumable', 100, 20, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'A8'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 12.00, NOW()),
('WIP-001', 'Wiper Blades - 22in', 'consumable', 60, 10, 'Pair', 'Pair', (SELECT id FROM bin_locations WHERE bin_location = 'A9'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 18.00, NOW()),
('WIP-002', 'Wiper Blades - 24in', 'consumable', 45, 10, 'Pair', 'Pair', (SELECT id FROM bin_locations WHERE bin_location = 'A10'), (SELECT id FROM suppliers WHERE name = 'AutoParts Direct'), 18.00, NOW()),
-- Fluids
('OIL-001', 'Motor Oil 5W-30 - 5qt', 'fluid', 80, 15, 'Case', 'Quart', (SELECT id FROM bin_locations WHERE bin_location = 'B1'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 35.00, NOW()),
('OIL-002', 'Motor Oil 10W-40 - 5qt', 'fluid', 60, 10, 'Case', 'Quart', (SELECT id FROM bin_locations WHERE bin_location = 'B2'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 35.00, NOW()),
('OIL-003', 'Synthetic Oil 5W-30 - 5qt', 'fluid', 40, 8, 'Case', 'Quart', (SELECT id FROM bin_locations WHERE bin_location = 'B3'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 55.00, NOW()),
('TRN-001', 'Transmission Fluid', 'fluid', 30, 5, 'Gallon', 'Gallon', (SELECT id FROM bin_locations WHERE bin_location = 'B4'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 25.00, NOW()),
('BRK-FLD', 'Brake Fluid', 'fluid', 50, 10, 'Liter', 'Liter', (SELECT id FROM bin_locations WHERE bin_location = 'B5'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 15.00, NOW()),
('CLT-001', 'Coolant - 50/50', 'fluid', 70, 12, 'Gallon', 'Gallon', (SELECT id FROM bin_locations WHERE bin_location = 'B6'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 20.00, NOW()),
('PWR-001', 'Power Steering Fluid', 'fluid', 40, 8, 'Quart', 'Quart', (SELECT id FROM bin_locations WHERE bin_location = 'B7'), (SELECT id FROM suppliers WHERE name = 'Fluid Dynamics Inc'), 12.00, NOW()),
('WD-40', 'WD-40 Lubricant', 'fluid', 100, 20, 'Can', 'Can', (SELECT id FROM bin_locations WHERE bin_location = 'B8'), (SELECT id FROM suppliers WHERE name = 'Industrial Supplies Co'), 8.00, NOW()),
('GREASE', 'Wheel Bearing Grease', 'fluid', 25, 5, 'Tub', 'Tub', (SELECT id FROM bin_locations WHERE bin_location = 'B9'), (SELECT id FROM suppliers WHERE name = 'Industrial Supplies Co'), 15.00, NOW()),
('SOLV-001', 'Parts Cleaner', 'fluid', 35, 7, 'Gallon', 'Gallon', (SELECT id FROM bin_locations WHERE bin_location = 'B10'), (SELECT id FROM suppliers WHERE name = 'Industrial Supplies Co'), 18.00, NOW()),
-- Tools
('TL-001', 'Impact Wrench - 1/2in', 'tool', 15, 3, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C1'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 150.00, NOW()),
('TL-002', 'Impact Wrench - 3/8in', 'tool', 12, 3, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C2'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 120.00, NOW()),
('TL-003', 'Torque Wrench', 'tool', 8, 2, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C3'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 200.00, NOW()),
('TL-004', 'Socket Set - 1/4in', 'tool', 10, 2, 'Set', 'Set', (SELECT id FROM bin_locations WHERE bin_location = 'C4'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 80.00, NOW()),
('TL-005', 'Socket Set - 3/8in', 'tool', 10, 2, 'Set', 'Set', (SELECT id FROM bin_locations WHERE bin_location = 'C5'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 100.00, NOW()),
('TL-006', 'Socket Set - 1/2in', 'tool', 8, 2, 'Set', 'Set', (SELECT id FROM bin_locations WHERE bin_location = 'C6'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 120.00, NOW()),
('TL-007', 'Ratchet - 1/4in', 'tool', 20, 4, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C7'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 35.00, NOW()),
('TL-008', 'Ratchet - 3/8in', 'tool', 20, 4, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C8'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 40.00, NOW()),
('TL-009', 'Ratchet - 1/2in', 'tool', 15, 3, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C9'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 45.00, NOW()),
('TL-010', 'Breaker Bar - 18in', 'tool', 12, 2, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C10'), (SELECT id FROM suppliers WHERE name = 'ToolMaster Supply'), 50.00, NOW()),
-- Tires
('TIR-001', 'Tire 205/55R16', 'tire', 40, 8, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C1'), (SELECT id FROM suppliers WHERE name = 'Tire Kingdom'), 120.00, NOW()),
('TIR-002', 'Tire 225/60R17', 'tire', 35, 7, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C2'), (SELECT id FROM suppliers WHERE name = 'Tire Kingdom'), 140.00, NOW()),
('TIR-003', 'Tire 245/45R18', 'tire', 25, 5, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C3'), (SELECT id FROM suppliers WHERE name = 'Tire Kingdom'), 180.00, NOW()),
('TIR-004', 'Tire 265/70R17', 'tire', 20, 4, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C4'), (SELECT id FROM suppliers WHERE name = 'Tire Kingdom'), 200.00, NOW()),
('TIR-005', 'Tire 275/55R20', 'tire', 15, 3, 'Each', 'Each', (SELECT id FROM bin_locations WHERE bin_location = 'C5'), (SELECT id FROM suppliers WHERE name = 'Tire Kingdom'), 220.00, NOW())
ON CONFLICT (sku) DO NOTHING;

-- ============================================================================
-- STOCK MOVEMENTS (attributed to the demo admin)
-- ============================================================================
-- Guarded so re-running the seed doesn't duplicate history rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stock_movements) THEN
INSERT INTO stock_movements (product_id, user_id, type, quantity, reason) VALUES
-- Inbound movements
((SELECT id FROM products WHERE sku = 'BRK-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'inbound', 100, 'Initial stock'),
((SELECT id FROM products WHERE sku = 'OIL-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'inbound', 50, 'Initial stock'),
((SELECT id FROM products WHERE sku = 'TL-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'inbound', 10, 'Initial stock'),
((SELECT id FROM products WHERE sku = 'TIR-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'inbound', 30, 'Initial stock'),
-- Outbound movements
((SELECT id FROM products WHERE sku = 'BRK-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'outbound', -20, 'Used for vehicle service'),
((SELECT id FROM products WHERE sku = 'OIL-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'outbound', -15, 'Used for oil change'),
((SELECT id FROM products WHERE sku = 'FLT-001'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'outbound', -10, 'Used for vehicle service'),
-- Scrap movements
((SELECT id FROM products WHERE sku = 'BRK-002'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'scrap', -5, 'Damaged goods'),
((SELECT id FROM products WHERE sku = 'TIR-002'), (SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'scrap', -2, 'Damaged tire');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tool_loans) THEN
-- ============================================================================
-- TOOL LOANS
-- ============================================================================
INSERT INTO tool_loans (tool_product_id, worker_profile_id, checked_out_by_user_id, condition_on_checkout, notes) VALUES
((SELECT id FROM products WHERE sku = 'TL-001'), (SELECT id FROM auth.users WHERE email = 'demo.worker@vms-demo.com'), (SELECT id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com'), 'Good', 'Routine maintenance'),
((SELECT id FROM products WHERE sku = 'TL-003'), (SELECT id FROM auth.users WHERE email = 'demo.worker@vms-demo.com'), (SELECT id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com'), 'Excellent', 'Tightening bolts'),
((SELECT id FROM products WHERE sku = 'TL-004'), (SELECT id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com'), (SELECT id FROM auth.users WHERE email = 'demo.manager@vms-demo.com'), 'Good', 'Socket work');

-- Add some returned tool loans
INSERT INTO tool_loans (tool_product_id, worker_profile_id, checked_out_by_user_id, condition_on_checkout, condition_on_return, returned_at, notes) VALUES
((SELECT id FROM products WHERE sku = 'TL-002'), (SELECT id FROM auth.users WHERE email = 'demo.worker@vms-demo.com'), (SELECT id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com'), 'Good', 'Good', NOW() - INTERVAL '2 days', 'Returned after use'),
((SELECT id FROM products WHERE sku = 'TL-005'), (SELECT id FROM auth.users WHERE email = 'demo.worker@vms-demo.com'), (SELECT id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com'), 'Excellent', 'Excellent', NOW() - INTERVAL '1 day', 'Returned after use');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM stock_takes) THEN
-- ============================================================================
-- STOCK TAKES
-- ============================================================================
INSERT INTO stock_takes (started_by, status, notes) VALUES
((SELECT id FROM auth.users WHERE email = 'demo.manager@vms-demo.com'), 'open', 'Monthly inventory count - Zone A'),
((SELECT id FROM auth.users WHERE email = 'demo.admin@vms-demo.com'), 'completed', 'Weekly spot check - Zone B');

-- Add stock take items for the open stock take
INSERT INTO stock_take_items (stock_take_id, product_id, system_qty, physical_qty, variance) VALUES
((SELECT id FROM stock_takes WHERE status = 'open' LIMIT 1), (SELECT id FROM products WHERE sku = 'BRK-001'), 150, 150, 0),
((SELECT id FROM stock_takes WHERE status = 'open' LIMIT 1), (SELECT id FROM products WHERE sku = 'FLT-001'), 200, 198, -2),
((SELECT id FROM stock_takes WHERE status = 'open' LIMIT 1), (SELECT id FROM products WHERE sku = 'AIR-001'), 180, 180, 0);

-- Add stock take items for the completed stock take
INSERT INTO stock_take_items (stock_take_id, product_id, system_qty, physical_qty, variance) VALUES
((SELECT id FROM stock_takes WHERE status = 'completed' LIMIT 1), (SELECT id FROM products WHERE sku = 'OIL-001'), 80, 80, 0),
((SELECT id FROM stock_takes WHERE status = 'completed' LIMIT 1), (SELECT id FROM products WHERE sku = 'TRN-001'), 30, 29, -1);

-- Update completed stock take
UPDATE stock_takes
SET completed_at = NOW() - INTERVAL '3 days'
WHERE status = 'completed';
  END IF;
END $$;
