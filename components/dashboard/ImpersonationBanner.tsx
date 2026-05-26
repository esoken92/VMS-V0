'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { X, Shield } from 'lucide-react';

export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedByUser, exitImpersonation, profile } = useAuth();

  if (!isImpersonating) return null;

  return (
    <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Viewing as:</span>
          <span className="text-sm font-bold">{profile?.full_name || 'Unknown User'}</span>
          <span className="text-sm text-purple-200">({profile?.role})</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => exitImpersonation()}
        className="flex items-center gap-2 px-3 py-1 bg-purple-700 hover:bg-purple-800 rounded-lg text-sm font-medium transition-colors"
      >
        <X className="h-4 w-4" />
        Exit View Mode
      </button>
    </div>
  );
}
