/**
 * POST /api/scan — REST boundary for scan resolution (hardware wedges,
 * integrations, scripts that can't call server actions). Same pipeline as
 * the submitScan server action via lib/scan/engine.
 *
 * Body: { code: string, input_type: 'camera'|'hid'|'manual'|'rfid',
 *         device_label?: string|null, location_context?: string|null }
 * → 200 { resolution: ScanResolutionDTO }   (scan-level failures ride in
 *   resolution.ok/​error — every attempt is logged to scan_events)
 * → 400 malformed body · 401 unauthenticated · 500 unexpected
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AuthError } from '@/lib/result';
import { SCAN_INPUT_TYPES } from '@/drizzle/scan-schema';
import { processScan } from '@/lib/scan/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  code: z.string().min(1).max(512),
  input_type: z.enum(SCAN_INPUT_TYPES),
  device_label: z.string().max(64).nullable().optional(),
  location_context: z.string().max(64).nullable().optional(),
});

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    throw err;
  }

  const parsed = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const resolution = await processScan(ctx, parsed.data);
    return NextResponse.json({ resolution });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500 },
    );
  }
}
