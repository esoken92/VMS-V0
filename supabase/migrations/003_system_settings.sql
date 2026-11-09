-- System Settings Table
-- Stores configurable system settings for the VMS application

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only super_admins can read settings
CREATE POLICY "Super admins can read settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super_admins can insert settings
CREATE POLICY "Super admins can insert settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super_admins can update settings
CREATE POLICY "Super admins can update settings"
  ON system_settings
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

-- Only super_admins can delete settings
CREATE POLICY "Super admins can delete settings"
  ON system_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Insert default settings
INSERT INTO system_settings (key, value, category, description) VALUES
  ('company_name', 'VMS Inventory Management', 'general', 'Company name displayed in the application'),
  ('logo_url', '', 'general', 'URL to company logo'),
  ('timezone', 'UTC', 'general', 'Default timezone for the application'),
  ('low_stock_alert_enabled', 'true', 'notifications', 'Enable low stock email alerts'),
  ('low_stock_threshold', '10', 'inventory', 'Default low stock threshold'),
  ('overdue_tool_alert_enabled', 'true', 'notifications', 'Enable overdue tool email alerts'),
  ('session_timeout_minutes', '60', 'security', 'Session timeout in minutes'),
  ('password_min_length', '8', 'security', 'Minimum password length')
ON CONFLICT (key) DO NOTHING;

-- Update trigger
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
