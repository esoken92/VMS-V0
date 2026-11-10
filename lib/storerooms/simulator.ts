/**
 * lib/storerooms/simulator — realistic fake telemetry so the monitoring
 * end-to-end testing without hardware. Feeds the SAME ingest path
 * as real devices (lib/storerooms/ingest.ts) — idempotent keys, alert
 * evaluation, everything.
 *
 * Behaviour:
 *   - temperature-having rooms (cold/frozen/dry/it/hazmat or any room with
 *     a temp range configured) emit a slow sinusoid around the range
 *     midpoint + gaussian-ish noise, so cold rooms hover 2–8 °C
 *   - ~4% of ticks push an excursion outside the range (or `force_excursion`
 *     does it deterministically) → enough to open threshold alerts
 *   - humidity follows a slow drift; door/motion metrics emit sparse
 *     boolean-ish events only when the room's feature toggles enable them
 *   - device ids are deterministic (sim-<room8>-<metric>) so replays and
 *     duplicate ticks hit the ingest idempotency key instead of duplicating
 *
 * Server-only.
 */

import type { StoreroomRow } from '@/drizzle/storerooms-schema';
import type { IngestReadingInput } from './ingest';
import { METRIC_DEFAULT_UNITS, type SensorMetric } from './room-types';

export interface SimulateOptions {
  /** Force every temperature-capable room to breach its range this tick. */
  forceExcursion?: boolean;
  /** Number of ticks to generate (history backfill). Default 1. */
  points?: number;
  /** Spacing between ticks in minutes. Default 15. */
  stepMinutes?: number;
  /** End time of the generated series. Default now. */
  endAt?: Date;
}

/** Deterministic per (room, tick, metric) pseudo-random in [0,1). */
function seededNoise(roomId: string, tickMs: number, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < roomId.length; i++) {
    h ^= roomId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= tickMs | 0;
  h = Math.imul(h, 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function deviceId(roomId: string, metric: SensorMetric): string {
  return `sim-${roomId.slice(0, 8)}-${metric}`;
}

/** Effective temp range for simulation: room bounds, else type-typical. */
function effectiveRange(room: StoreroomRow): { min: number; max: number } | null {
  const min = room.tempMin === null ? null : Number(room.tempMin);
  const max = room.tempMax === null ? null : Number(room.tempMax);
  if (min !== null && max !== null) return { min, max };
  // No range configured — only ambient rooms worth charting get a default.
  switch (room.type) {
    case 'cold':
      return { min: 2, max: 8 };
    case 'frozen':
      return { min: -25, max: -15 };
    case 'dry':
      return { min: 15, max: 25 };
    case 'it':
      return { min: 18, max: 27 };
    case 'hazmat':
      return { min: 15, max: 25 };
    case 'general':
    case 'staging':
    case 'dock':
      return { min: 15, max: 24 };
    default:
      return null;
  }
}

/** One tick of readings for a single room at time `at`. */
export function simulateRoomTick(
  room: StoreroomRow,
  at: Date,
  forceExcursion = false,
): IngestReadingInput[] {
  const out: IngestReadingInput[] = [];
  const t = at.getTime();
  const toggles = room.featureToggles ?? {};

  const push = (metric: SensorMetric, value: number, unit?: string) =>
    out.push({
      room_id: room.id,
      metric,
      value: Math.round(value * 100) / 100,
      unit: unit ?? METRIC_DEFAULT_UNITS[metric],
      device_id: deviceId(room.id, metric),
      recorded_at: at,
    });

  // --- temperature -------------------------------------------------------
  const range = effectiveRange(room);
  const monitored =
    toggles.environmental_monitoring !== false || range !== null;
  if (range && monitored) {
    const mid = (range.min + range.max) / 2;
    const halfSpan = Math.max((range.max - range.min) / 2, 1);
    // ~2h sinusoid + small noise keeps values inside the range most ticks.
    const wave = Math.sin(t / (2 * 60 * 60 * 1000)) * halfSpan * 0.6;
    const noise = (seededNoise(room.id, t, 1) - 0.5) * halfSpan * 0.3;
    let temp = mid + wave + noise;

    const excursionRoll = seededNoise(room.id, t, 2);
    if (forceExcursion || excursionRoll < 0.04) {
      // Push past the high bound — a door-left-open style excursion.
      temp = range.max + 0.5 + seededNoise(room.id, t, 3) * halfSpan * 0.8;
    }
    push('temperature', temp);

    // --- humidity --------------------------------------------------------
    // Slow drift 30–70 %RH, slightly inverse to temperature.
    const humidity =
      50 + Math.sin(t / (3 * 60 * 60 * 1000) + 1) * 15 +
      (seededNoise(room.id, t, 4) - 0.5) * 6 -
      (temp - mid) * 1.5;
    push('humidity', Math.min(95, Math.max(5, humidity)));
  }

  // --- door / motion / vibration — only when the feature is enabled ------
  if (toggles.door_monitoring) {
    const open = seededNoise(room.id, t, 5) < 0.08 ? 1 : 0;
    push('door', open, 'open');
  }
  if (toggles.motion_detection) {
    const motion = seededNoise(room.id, t, 6) < 0.15 ? 1 : 0;
    push('motion', motion, 'events');
  }
  if (toggles.vibration_monitoring) {
    push('vibration', seededNoise(room.id, t, 7) * 0.4, 'g');
  }

  return out;
}

/**
 * A batch of readings across all rooms — `points` ticks spaced
 * `stepMinutes` apart ending at `endAt` (oldest first). The excursion tick,
 * when forced, lands on the newest point so alert state reflects "now".
 */
export function simulateBatch(
  rooms: StoreroomRow[],
  opts: SimulateOptions = {},
): IngestReadingInput[] {
  const points = Math.min(Math.max(opts.points ?? 1, 1), 500);
  const stepMs = Math.max(opts.stepMinutes ?? 15, 1) * 60_000;
  const end = (opts.endAt ?? new Date()).getTime();

  const batch: IngestReadingInput[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const at = new Date(end - i * stepMs);
    const excursion = opts.forceExcursion === true && i === 0;
    for (const room of rooms) {
      if (!room.active) continue;
      batch.push(...simulateRoomTick(room, at, excursion));
    }
  }
  return batch;
}
