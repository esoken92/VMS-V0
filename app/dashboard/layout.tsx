'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider';
import { Shield, LogOut } from 'lucide-react';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isImpersonating, impersonatedByUser, exitImpersonation, ensureProfile } = useAuth();

  // Load profile lazily when dashboard is accessed
  useEffect(() => {
    ensureProfile();
  }, [ensureProfile]);

  const handleExitImpersonation = () => {
    const result = exitImpersonation();
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

        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-900">
                  Viewing as <strong>{impersonatedByUser?.full_name || 'Unknown'}</strong> (Impersonation Mode)
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
