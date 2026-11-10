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
      <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>

      <h1 className="text-2xl font-bold text-foreground">403 — Access denied</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Your current role doesn&apos;t have permission to view this page.
        {searchParams.denied ? (
          <>
            {' '}
            Requested: <code className="text-xs bg-muted px-1 py-0.5 rounded">{searchParams.denied}</code>.
          </>
        ) : null}{' '}
        If you need access, contact an administrator.
      </p>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </div>
  );
}
