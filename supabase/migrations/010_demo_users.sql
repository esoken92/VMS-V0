-- Create demo users for VMS demo site
-- These accounts are for demonstration purposes only

-- Demo Admin (super_admin) - Full access to all features
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  (gen_random_uuid(), 'demo.admin@vms-demo.com', crypt('DemoAdmin123!', gen_salt('bf')), NOW())
ON CONFLICT (email) DO NOTHING;

-- Get the user ID and create profile
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'demo.admin@vms-demo.com' LIMIT 1;
  
  INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
  VALUES (gen_random_uuid(), admin_user_id, 'Demo Admin', 'super_admin', true, true)
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
END $$;

-- Demo Manager (manager) - Management access to inventory and reports
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  (gen_random_uuid(), 'demo.manager@vms-demo.com', crypt('DemoManager123!', gen_salt('bf')), NOW())
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  manager_user_id UUID;
BEGIN
  SELECT id INTO manager_user_id FROM auth.users WHERE email = 'demo.manager@vms-demo.com' LIMIT 1;
  
  INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
  VALUES (gen_random_uuid(), manager_user_id, 'Demo Manager', 'manager', true, true)
  ON CONFLICT (user_id) DO UPDATE SET role = 'manager';
END $$;

-- Demo Fleet Dispatch (fleet_dispatch) - Tool loan and movement access
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  (gen_random_uuid(), 'demo.fleet@vms-demo.com', crypt('DemoFleet123!', gen_salt('bf')), NOW())
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  fleet_user_id UUID;
BEGIN
  SELECT id INTO fleet_user_id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com' LIMIT 1;
  
  INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
  VALUES (gen_random_uuid(), fleet_user_id, 'Demo Fleet Dispatch', 'fleet_dispatch', true, true)
  ON CONFLICT (user_id) DO UPDATE SET role = 'fleet_dispatch';
END $$;

-- Demo Worker (staff) - Basic read access and limited actions
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES 
  (gen_random_uuid(), 'demo.worker@vms-demo.com', crypt('DemoWorker123!', gen_salt('bf')), NOW())
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  worker_user_id UUID;
BEGIN
  SELECT id INTO worker_user_id FROM auth.users WHERE email = 'demo.worker@vms-demo.com' LIMIT 1;
  
  INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
  VALUES (gen_random_uuid(), worker_user_id, 'Demo Worker', 'staff', true, true)
  ON CONFLICT (user_id) DO UPDATE SET role = 'staff';
END $$;
