'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import PreviewBanner from '@/components/dashboard/PreviewBanner';
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider';
import { getFeatureFlags } from '@/lib/actions/provisioning';
import { setClientFeatures } from '@/lib/features';
import { Shield, LogOut } from 'lucide-react';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isImpersonating, profile, impersonatedByUser, exitImpersonation, ensureProfile, persona } = useAuth();
  // Assume provisioned until the flags load — avoids flashing the banner.
  const [provisioned, setProvisioned] = useState(true);
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  // Load profile lazily when dashboard is accessed
  useEffect(() => {
    ensureProfile();
  }, [ensureProfile]);

  // Load provisioning-derived feature flags once per session and publish
  // them into the client flag cache — visibleNavItems() consults it when
  // the Sidebar re-renders (this state change is the trigger), so flag-gated
  // nav items hide without touching Sidebar or prop drilling.
  useEffect(() => {
    let cancelled = false;
    getFeatureFlags()
      .then((res) => {
        if (cancelled || !res.success) return;
        setClientFeatures(res.data);
        setProvisioned(res.data !== null);
        setFlagsLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExitImpersonation = async () => {
    const result = await exitImpersonation();
    if (result.success) {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 md:hidden">
          <div className="p-6 border-b border-gray-800">
            <h1 className="text-lg font-bold text-white">VMS</h1>
            <p className="text-xs text-gray-400">Inventory</p>
          </div>
          {/* Mobile menu items would go here */}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64">
        {/* TopBar */}
        <TopBar onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* "View as worker" preview banner (renders only when active) */}
        <PreviewBanner />

        {/* "Finish setup" banner — builder persona only, shown until the
            provisioning wizard has run at least once. Operators never see
            it (persona already accounts for worker preview). */}
        {flagsLoaded && !provisioned && persona === 'builder' && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <p className="text-sm text-amber-900">
                This instance hasn&apos;t been configured yet — pick an
                industry and stock policies to tailor the menus, fields and
                workflows.
              </p>
              <Link
                href="/dashboard/setup"
                className="ml-4 shrink-0 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                Finish setup
              </Link>
            </div>
          </div>
        )}

        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-900">
                  Viewing as <strong>{profile?.full_name || 'Unknown'}</strong>
                  {impersonatedByUser?.full_name
                    ? ` — signed in as ${impersonatedByUser.full_name}`
                    : ''}{' '}
                  (Impersonation Mode)
                </p>
              </div>
              <button
                onClick={handleExitImpersonation}
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
              >
                <LogOut className="h-4 w-4" />
                Exit
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
