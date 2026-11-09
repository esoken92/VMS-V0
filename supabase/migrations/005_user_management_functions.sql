-- User Management RPC Functions
-- Functions for managing users, profiles, and impersonation
--
-- SECURITY MODEL
-- ==============
-- SECURITY DEFINER functions run with the privileges of the function owner
-- and BYPASS row-level security. Every DEFINER function below therefore
-- performs its own authorization check against profiles before acting.
-- Read-only helpers that can rely on RLS use SECURITY INVOKER instead.
--
-- Convention: profiles.id == auth.users.id (1:1). This is what the RLS
-- policies (profiles.id = auth.uid()) and the app assume.

-- Helper: current caller's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Get all users with their profiles (admin and super_admin only)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role user_role,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    p.full_name,
    p.role,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.user_id
  ORDER BY u.created_at DESC;
END;
$$;

-- Create user with profile (admin and super_admin only)
-- Only a super_admin may create another super_admin.
CREATE OR REPLACE FUNCTION create_user_with_profile(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role user_role DEFAULT 'staff'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_user_id UUID;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_role = 'super_admin' AND v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'insufficient_privilege: only super_admin can create a super_admin';
  END IF;

  -- Create auth user
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), NOW())
  RETURNING id INTO v_user_id;

  -- Create profile: profiles.id mirrors the auth user id (see header)
  INSERT INTO profiles (id, user_id, full_name, role)
  VALUES (v_user_id, v_user_id, p_full_name, p_role);

  RETURN v_user_id;
END;
$$;

-- Update user role (admin and super_admin only)
-- Only a super_admin may grant or revoke the super_admin role.
CREATE OR REPLACE FUNCTION update_user_role(
  p_user_id UUID,
  p_new_role user_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_new_role = 'super_admin' AND v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'insufficient_privilege: only super_admin can grant super_admin';
  END IF;

  UPDATE profiles
  SET role = p_new_role, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Update user profile (self, or admin/super_admin)
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_full_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  UPDATE profiles
  SET full_name = p_full_name, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Delete user (super_admin only; cascades to profile via FK)
CREATE OR REPLACE FUNCTION delete_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

-- Get system settings
-- SECURITY INVOKER: RLS on system_settings already restricts reads
-- to super_admin; no privileged path needed.
CREATE OR REPLACE FUNCTION get_system_settings()
RETURNS TABLE (
  key TEXT,
  value TEXT,
  category TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT key, value, category, description, updated_at
  FROM system_settings
  ORDER BY category, key;
END;
$$;

-- Update system setting (super_admin only)
CREATE OR REPLACE FUNCTION update_system_setting(
  p_key TEXT,
  p_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  UPDATE system_settings
  SET value = p_value, updated_at = NOW()
  WHERE key = p_key;

  RETURN FOUND;
END;
$$;

-- Start impersonation session (super_admin only)
CREATE OR REPLACE FUNCTION start_impersonation(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  INSERT INTO impersonation_sessions (impersonator_id, target_user_id, reason)
  VALUES (auth.uid(), p_target_user_id, p_reason)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- End impersonation session (self-scoped)
CREATE OR REPLACE FUNCTION end_impersonation(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE impersonation_sessions
  SET ended_at = NOW()
  WHERE id = p_session_id AND impersonator_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- Get active impersonation session for current user
-- DEFINER is required: the SELECT policy on impersonation_sessions is
-- super_admin-only, but the *target* of an impersonation must be able to
-- see that it is happening. The WHERE clause keeps results self-scoped.
CREATE OR REPLACE FUNCTION get_active_impersonation()
RETURNS TABLE (
  session_id UUID,
  impersonator_id UUID,
  impersonator_name TEXT,
  target_user_id UUID,
  target_user_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    isess.id as session_id,
    isess.impersonator_id,
    p_impersonator.full_name as impersonator_name,
    isess.target_user_id,
    p_target.full_name as target_user_name,
    isess.started_at
  FROM impersonation_sessions isess
  JOIN profiles p_impersonator ON isess.impersonator_id = p_impersonator.user_id
  JOIN profiles p_target ON isess.target_user_id = p_target.user_id
  WHERE isess.target_user_id = auth.uid()
  AND isess.ended_at IS NULL;
END;
$$;

-- Grant execute permissions to authenticated users.
-- Authorization is enforced inside each function (or by RLS for INVOKER).
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_profile(TEXT, TEXT, TEXT, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role(UUID, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION update_system_setting(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_impersonation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION end_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_impersonation() TO authenticated;
