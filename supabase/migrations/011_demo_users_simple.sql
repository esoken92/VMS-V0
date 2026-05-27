-- Create demo users for VMS demo site
-- These accounts are for demonstration purposes only
-- This migration assumes the schema already exists

-- Demo Admin (super_admin) - Full access to all features
DO $$
DECLARE
  admin_user_id UUID;
  admin_profile_id UUID;
BEGIN
  -- Check if user exists, if not create it
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'demo.admin@vms-demo.com' LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
    VALUES (gen_random_uuid(), 'demo.admin@vms-demo.com', crypt('DemoAdmin123!', gen_salt('bf')), NOW())
    RETURNING id INTO admin_user_id;
  END IF;
  
  -- Check if profile exists, if not create it
  SELECT id INTO admin_profile_id FROM profiles WHERE user_id = admin_user_id LIMIT 1;
  
  IF admin_profile_id IS NULL THEN
    INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
    VALUES (gen_random_uuid(), admin_user_id, 'Demo Admin', 'super_admin', true, true);
  ELSE
    UPDATE profiles SET role = 'super_admin' WHERE id = admin_profile_id;
  END IF;
END $$;

-- Demo Manager (manager) - Management access to inventory and reports
DO $$
DECLARE
  manager_user_id UUID;
  manager_profile_id UUID;
BEGIN
  SELECT id INTO manager_user_id FROM auth.users WHERE email = 'demo.manager@vms-demo.com' LIMIT 1;
  
  IF manager_user_id IS NULL THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
    VALUES (gen_random_uuid(), 'demo.manager@vms-demo.com', crypt('DemoManager123!', gen_salt('bf')), NOW())
    RETURNING id INTO manager_user_id;
  END IF;
  
  SELECT id INTO manager_profile_id FROM profiles WHERE user_id = manager_user_id LIMIT 1;
  
  IF manager_profile_id IS NULL THEN
    INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
    VALUES (gen_random_uuid(), manager_user_id, 'Demo Manager', 'manager', true, true);
  ELSE
    UPDATE profiles SET role = 'manager' WHERE id = manager_profile_id;
  END IF;
END $$;

-- Demo Fleet Dispatch (fleet_dispatch) - Tool loan and movement access
DO $$
DECLARE
  fleet_user_id UUID;
  fleet_profile_id UUID;
BEGIN
  SELECT id INTO fleet_user_id FROM auth.users WHERE email = 'demo.fleet@vms-demo.com' LIMIT 1;
  
  IF fleet_user_id IS NULL THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
    VALUES (gen_random_uuid(), 'demo.fleet@vms-demo.com', crypt('DemoFleet123!', gen_salt('bf')), NOW())
    RETURNING id INTO fleet_user_id;
  END IF;
  
  SELECT id INTO fleet_profile_id FROM profiles WHERE user_id = fleet_user_id LIMIT 1;
  
  IF fleet_profile_id IS NULL THEN
    INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
    VALUES (gen_random_uuid(), fleet_user_id, 'Demo Fleet Dispatch', 'fleet_dispatch', true, true);
  ELSE
    UPDATE profiles SET role = 'fleet_dispatch' WHERE id = fleet_profile_id;
  END IF;
END $$;

-- Demo Worker (staff) - Basic read access and limited actions
DO $$
DECLARE
  worker_user_id UUID;
  worker_profile_id UUID;
BEGIN
  SELECT id INTO worker_user_id FROM auth.users WHERE email = 'demo.worker@vms-demo.com' LIMIT 1;
  
  IF worker_user_id IS NULL THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
    VALUES (gen_random_uuid(), 'demo.worker@vms-demo.com', crypt('DemoWorker123!', gen_salt('bf')), NOW())
    RETURNING id INTO worker_user_id;
  END IF;
  
  SELECT id INTO worker_profile_id FROM profiles WHERE user_id = worker_user_id LIMIT 1;
  
  IF worker_profile_id IS NULL THEN
    INSERT INTO profiles (id, user_id, full_name, role, alert_low_stock, alert_overdue_tools)
    VALUES (gen_random_uuid(), worker_user_id, 'Demo Worker', 'staff', true, true);
  ELSE
    UPDATE profiles SET role = 'staff' WHERE id = worker_profile_id;
  END IF;
END $$;
