-- Impersonation Sessions Table
-- Tracks when super_admins impersonate other users for audit purposes

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  impersonator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  reason TEXT
);

-- Enable RLS
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only super_admins can read impersonation sessions
CREATE POLICY "Super admins can read impersonation sessions"
  ON impersonation_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super_admins can insert impersonation sessions
CREATE POLICY "Super admins can insert impersonation sessions"
  ON impersonation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super_admins can update impersonation sessions (to end them)
CREATE POLICY "Super admins can update impersonation sessions"
  ON impersonation_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Index for active sessions
CREATE INDEX idx_impersonation_sessions_active ON impersonation_sessions(ended_at) WHERE ended_at IS NULL;
