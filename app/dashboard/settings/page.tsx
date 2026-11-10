'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { listSettings, updateSettings } from '@/lib/actions/settings';
import { Save, CheckCircle, AlertCircle, Building, Bell, Package, Shield, Upload, X } from 'lucide-react';

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Check if user is super_admin
  const isSuperAdmin = hasRole('super_admin');

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSettings();
    }
  }, [isSuperAdmin]);

  const fetchSettings = async () => {
    try {
      const result = await listSettings();
      if (!result.success) throw new Error(result.error);

      const settingsMap: Record<string, string> = {};
      for (const setting of result.data) {
        settingsMap[setting.key] = setting.value;
      }
      setSettings(settingsMap);

      // Set logo preview if exists
      if (settingsMap.logo_url) {
        setLogoPreview(settingsMap.logo_url);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 2MB' });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoRemove = () => {
    setLogoFile(null);
    setLogoPreview('');
    setSettings({ ...settings, logo_url: '' });
  };

  const handleLogoSave = async () => {
    if (!logoFile) return;

    setIsUploadingLogo(true);
    setMessage(null);

    try {
      // Local filesystem upload (replaces Supabase Storage)
      const body = new FormData();
      body.append('file', logoFile);
      body.append('kind', 'logo');
      const res = await fetch('/api/uploads', { method: 'POST', body });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Logo upload failed');
      }
      const { url: logoUrl } = (await res.json()) as { url: string };

      const result = await updateSettings({ entries: { logo_url: logoUrl } });
      if (!result.success) throw new Error(result.error);

      setSettings({ ...settings, logo_url: logoUrl });
      setMessage({ type: 'success', text: 'Logo uploaded successfully' });
      setLogoFile(null);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to upload logo' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await updateSettings({ entries: settings });
      if (!result.success) throw new Error(result.error);

      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">System configuration</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
          <p className="text-destructive">Access denied. Only super admins can access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">System configuration (Super Admin only)</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-success' : 'text-destructive'
          }`}>{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Settings */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-info/10 rounded-lg">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">General Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Name</label>
              <input
                type="text"
                value={settings.company_name || ''}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Logo</label>
              <div className="space-y-3">
                {logoPreview && (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview may be a blob/data URL which next/image cannot optimize */}
                    <img
                      src={logoPreview}
                      alt="Company Logo"
                      className="h-20 w-auto object-contain border border-border rounded-lg p-2"
                    />
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg cursor-pointer hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Choose Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {logoFile && (
                    <button
                      type="button"
                      onClick={handleLogoSave}
                      disabled={isUploadingLogo}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
                    >
                      {isUploadingLogo ? 'Uploading...' : 'Save Logo'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, or GIF (max 2MB)</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
              <select
                value={settings.timezone || 'UTC'}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-success/10 rounded-lg">
              <Bell className="h-5 w-5 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Notification Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Low Stock Alerts</p>
                <p className="text-sm text-muted-foreground">Send email alerts when stock is low</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.low_stock_alert_enabled === 'true'}
                  onChange={(e) => setSettings({ ...settings, low_stock_alert_enabled: e.target.checked ? 'true' : 'false' })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-input peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-input after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Overdue Tool Alerts</p>
                <p className="text-sm text-muted-foreground">Send email alerts for overdue tools</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.overdue_tool_alert_enabled === 'true'}
                  onChange={(e) => setSettings({ ...settings, overdue_tool_alert_enabled: e.target.checked ? 'true' : 'false' })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-input peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-input after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Inventory Settings */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-info/10 rounded-lg">
              <Package className="h-5 w-5 text-info" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Inventory Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Low Stock Threshold</label>
              <input
                type="number"
                value={settings.low_stock_threshold || ''}
                onChange={(e) => setSettings({ ...settings, low_stock_threshold: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum quantity before low stock alert</p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Security Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Session Timeout (minutes)</label>
              <input
                type="number"
                value={settings.session_timeout_minutes || ''}
                onChange={(e) => setSettings({ ...settings, session_timeout_minutes: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min="5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Minimum Password Length</label>
              <input
                type="number"
                value={settings.password_min_length || ''}
                onChange={(e) => setSettings({ ...settings, password_min_length: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min="6"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
