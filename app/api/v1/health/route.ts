import { apiJson } from '@/lib/api/http';
import { sqlClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/health — unauthenticated liveness/readiness probe.
 * `db: "up"` means a `SELECT 1` round-trip succeeded.
 */
export async function GET() {
  let db: 'up' | 'down' = 'up';
  try {
    await sqlClient`SELECT 1`;
  } catch {
    db = 'down';
  }
  return apiJson(
    {
      status: db === 'up' ? 'ok' : 'degraded',
      service: 'vms',
      version: 'v1',
      db,
      time: new Date().toISOString(),
    },
    { status: db === 'up' ? 200 : 503 },
  );
}
