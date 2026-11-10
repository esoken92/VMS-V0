/**
 * GET /api/sensors/readings?room=<uuid>&metric=<m>&hours=<n>&limit=<n>
 *
 * Chart data for the rooms/monitoring UIs. Session auth (any signed-in
 * user) — devices don't read.
 */

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { AuthError } from '@/lib/result';
import { getRoomReadings } from '@/lib/actions/sensors';
import { SENSOR_METRICS } from '@/lib/storerooms/room-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    throw err;
  }

  const url = new URL(request.url);
  const room = url.searchParams.get('room');
  if (!room) {
    return NextResponse.json(
      { error: 'Missing required query param: room' },
      { status: 400 },
    );
  }
  const metric = url.searchParams.get('metric');
  const hours = Number(url.searchParams.get('hours') ?? '24');
  const limit = Number(url.searchParams.get('limit') ?? '2000');

  const result = await getRoomReadings({
    room_id: room,
    metric:
      metric && (SENSOR_METRICS as readonly string[]).includes(metric)
        ? (metric as (typeof SENSOR_METRICS)[number])
        : undefined,
    hours: Number.isFinite(hours) ? hours : 24,
    limit: Number.isFinite(limit) ? limit : 2000,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ readings: result.data });
}
