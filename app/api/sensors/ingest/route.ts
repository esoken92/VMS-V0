/**
 * POST /api/sensors/ingest — device/gateway telemetry ingest.
 *
 * Auth: `Authorization: Bearer $SENSOR_API_KEY` (hardware) OR an
 * authenticated session (staff+ — e.g. dashboard UI, technician tablet).
 * Body: `{ readings: [...] }`, max 500 per call. Zod-validated.
 *
 * Writes are idempotent on UNIQUE(room_id, device_id, metric, recorded_at)
 * — replays/retries are duplicates, not errors. After insert, alert rules
 * are evaluated for the newly inserted rows only.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeSensorRequest } from '@/lib/storerooms/sensor-auth';
import { ingestReadings } from '@/lib/storerooms/ingest';
import { SENSOR_METRICS, METRIC_DEFAULT_UNITS } from '@/lib/storerooms/room-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BATCH = 500;

const readingSchema = z.object({
  room_id: z.string().uuid(),
  metric: z.enum(SENSOR_METRICS),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(20).optional(),
  device_id: z.string().trim().min(1).max(100),
  // Device clock may drift — accept it but bound it to ±30 days so a bad
  // timestamp can't corrupt chart windows or dwell evaluation.
  recorded_at: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

const bodySchema = z.object({
  readings: z.array(readingSchema).min(1).max(MAX_BATCH),
});

export async function POST(request: Request) {
  const authn = await authorizeSensorRequest(request);
  if (!authn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.slice(0, 10) },
      { status: 400 },
    );
  }

  const now = Date.now();
  const readings = parsed.data.readings.map((r) => ({
    room_id: r.room_id,
    metric: r.metric,
    value: r.value,
    unit: r.unit ?? METRIC_DEFAULT_UNITS[r.metric],
    device_id: r.device_id,
    recorded_at: r.recorded_at ? new Date(r.recorded_at) : new Date(),
  }));

  for (const r of readings) {
    if (Math.abs(now - r.recorded_at.getTime()) > 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'recorded_at more than 30 days from server time' },
        { status: 400 },
      );
    }
  }

  try {
    const result = await ingestReadings(
      readings,
      authn.mode === 'session'
        ? {
            userId: authn.ctx.user.id,
            impersonatorId: authn.ctx.impersonating
              ? authn.ctx.actor.id
              : null,
          }
        : null,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Ingest failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
