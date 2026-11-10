/**
 * PreviewBanner — slim banner shown while an admin/super_admin is in
 * "View as worker" mode (vms_preview=operator cookie).
 * Always rendered; returns null unless the preview is active.
 */

'use client';

import { useState } from 'react';
import { Eye, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function PreviewBanner() {
  const { previewAsOperator, exitWorkerPreview } = useAuth();
  const [exiting, setExiting] = useState(false);

  if (!previewAsOperator) return null;

  const handleExit = async () => {
    setExiting(true);
    await exitWorkerPreview();
    setExiting(false);
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-medium text-blue-800">
            Viewing as worker — navigation and access are limited to the
            operator surface
          </p>
        </div>
        <button
          onClick={handleExit}
          disabled={exiting}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {exiting ? 'Exiting…' : 'Exit preview'}
        </button>
      </div>
    </div>
  );
}
