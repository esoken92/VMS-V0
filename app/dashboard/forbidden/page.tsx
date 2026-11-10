/**
 * 403 — Access denied.
 *
 * Middleware redirects here when the effective role (impersonation- and
 * worker-preview-aware) fails a persona route gate in lib/persona.ts.
 * The page itself is intentionally ungated so denied users always land
 * somewhere useful — with their nav still rendered by the dashboard
 * layout — instead of looping.
 */

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Access denied — VMS',
};

export default function ForbiddenPage({
  searchParams,
}: {
  searchParams: { denied?: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <ShieldAlert className="h-8 w-8 text-red-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900">403 — Access denied</h1>
      <p className="text-sm text-gray-500 mt-2 max-w-md">
        Your current role doesn&apos;t have permission to view this page.
        {searchParams.denied ? (
          <>
            {' '}
            Requested: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{searchParams.denied}</code>.
          </>
        ) : null}{' '}
        If you need access, contact an administrator.
      </p>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </div>
  );
}
