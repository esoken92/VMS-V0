/**
 * GET|POST /api/sensors/simulate — generate realistic telemetry for every
 * active room and push it through the real ingest path. Admin only
 * (super_admin/admin) — this endpoint exists so demos work without hardware.
 *
 * Query params (both verbs):
 *   ?points=N         ticks per room (history backfill, default 1, max 500)
 *   ?step_minutes=N   spacing between ticks (default 15)
 *   ?excursion=1      force the newest tick to breach each room's temp range
 *                     (opens threshold alerts on demand — great for demos)
 *   ?room=<uuid>      restrict to one room
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { storerooms } from '@/drizzle/storerooms-schema';
import { requireRole } from '@/lib/auth/session';
import { AuthError } from '@/lib/result';
import { ingestReadings } from '@/lib/storerooms/ingest';
import { simulateBatch } from '@/lib/storerooms/simulator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  points: z.coerce.number().int().min(1).max(500).default(1),
  step_minutes: z.coerce.number().min(1).max(24 * 60).default(15),
  // z.coerce.boolean() maps 'false'→true, so parse the flag manually.
  excursion: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true' || v === 'yes'),
  room: z.string().uuid().optional(),
});

async function run(request: Request) {
  let ctx;
  try {
    ctx = await requireRole(['super_admin', 'admin']);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code === 'UNAUTHENTICATED' ? 'Not authenticated' : 'Forbidden' },
        { status: err.code === 'UNAUTHENTICATED' ? 401 : 403 },
      );
    }
    throw err;
  }

  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse({
    points: url.searchParams.get('points') ?? undefined,
    step_minutes: url.searchParams.get('step_minutes') ?? undefined,
    excursion: url.searchParams.get('excursion') ?? undefined,
    room: url.searchParams.get('room') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }
  const p = parsed.data;

  const rooms = await db
    .select()
    .from(storerooms)
    .where(
      p.room
        ? eq(storerooms.id, p.room)
        : eq(storerooms.active, true),
    );
  if (rooms.length === 0) {
    return NextResponse.json({ error: 'No rooms to simulate' }, { status: 404 });
  }

  const batch = simulateBatch(rooms, {
    points: p.points,
    stepMinutes: p.step_minutes,
    forceExcursion: p.excursion,
  });

  const result = await ingestReadings(batch, {
    userId: ctx.user.id,
    impersonatorId: ctx.impersonating ? ctx.actor.id : null,
  });

  return NextResponse.json({
    rooms: rooms.length,
    generated: batch.length,
    ...result,
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
