/**
 * lib/storerooms/sensor-auth — authentication for the device-facing sensor
 * API routes. Two credential modes:
 *
 *   1. `Authorization: Bearer <SENSOR_API_KEY>` — for hardware/gateway
 *      pushes. Compared in constant time (SHA-256 pre-hashed so length
 *      doesn't leak either). When the env var is unset the Bearer path
 *      always fails — no key configured means no key auth.
 *   2. Session cookie — any authenticated user (staff+) may ingest, e.g.
 *      the demo UI or a technician's tablet.
 *
 * A Bearer header that fails does NOT fall through to session auth — a
 * request presenting a device credential is authenticated as a device or
 * not at all.
 *
 * Server-only.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { currentUser, type CurrentAuth } from '@/lib/auth/session';

export type SensorAuth =
  | { mode: 'api_key' }
  | { mode: 'session'; ctx: CurrentAuth };

function keyEquals(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Returns the authenticated mode, or null → caller responds 401.
 */
export async function authorizeSensorRequest(
  request: Request,
): Promise<SensorAuth | null> {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    const expected = process.env.SENSOR_API_KEY;
    if (!expected || !token) return null;
    return keyEquals(token, expected) ? { mode: 'api_key' } : null;
  }

  const ctx = await currentUser().catch(() => null);
  return ctx ? { mode: 'session', ctx } : null;
}
