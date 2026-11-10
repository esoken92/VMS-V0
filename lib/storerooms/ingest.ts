/**
 * lib/storerooms/ingest — the single write path for sensor readings.
 * Used by POST /api/sensors/ingest (devices) and /api/sensors/simulate
 * (demo data) so both share idempotent upsert + alert evaluation.
 *
 * Idempotency: UNIQUE(room_id, device_id, metric, recorded_at) +
 * ON CONFLICT DO NOTHING — replays and retries are cheap no-ops, and only
 * readings that actually inserted feed alert evaluation.
 *
 * Server-only.
 */

import { db } from '@/lib/db';
import { sensorReadings } from '@/drizzle/storerooms-schema';
import { setAuditContext, type AuditActor } from '@/lib/db/context';
import { evaluateRulesForReadings } from './alerts';
import type { SensorMetric } from './room-types';
import type { IngestResultDTO } from './types';

export interface IngestReadingInput {
  room_id: string;
  metric: SensorMetric;
  value: number;
  unit: string;
  device_id: string;
  recorded_at: Date;
}

/**
 * Insert a batch of readings and evaluate alert rules for the inserts.
 * `actor` (optional) attributes alert rows to a session user — API-key
 * ingests pass null and the audit trigger records a null user_id.
 */
export async function ingestReadings(
  inputs: IngestReadingInput[],
  actor: AuditActor | null,
): Promise<IngestResultDTO> {
  if (inputs.length === 0) return { inserted: 0, duplicates: 0, alerts_opened: 0 };

  return db.transaction(async (tx) => {
    if (actor) {
      await setAuditContext(tx, actor);
    }

    const inserted = await tx
      .insert(sensorReadings)
      .values(
        inputs.map((r) => ({
          roomId: r.room_id,
          metric: r.metric,
          value: String(r.value),
          unit: r.unit,
          deviceId: r.device_id,
          recordedAt: r.recorded_at,
        })),
      )
      .onConflictDoNothing()
      .returning({
        roomId: sensorReadings.roomId,
        metric: sensorReadings.metric,
        value: sensorReadings.value,
        recordedAt: sensorReadings.recordedAt,
      });

    const alertsOpened = await evaluateRulesForReadings(
      tx,
      inserted.map((r) => ({
        roomId: r.roomId,
        metric: r.metric,
        value: Number(r.value),
        recordedAt: r.recordedAt,
      })),
    );

    return {
      inserted: inserted.length,
      duplicates: inputs.length - inserted.length,
      alerts_opened: alertsOpened,
    };
  });
}
