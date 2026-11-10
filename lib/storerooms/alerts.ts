/**
 * lib/storerooms/alerts — alert-rule evaluation, run inside the ingest
 * transaction after readings land.
 *
 * For every inserted (room, metric, value) point, each ACTIVE rule on that
 * room+metric is checked:
 *   - a live alert (state active|acknowledged) already exists → skip
 *     (the uq_alerts_one_open_per_rule partial unique index is the backstop)
 *   - dwell_minutes = 0 → a single breaching reading opens an alert
 *   - dwell_minutes > 0 → the breach must be SUSTAINED: every reading since
 *     the last non-breaching reading breaches, and that streak started at
 *     least dwell_minutes before the current reading
 *
 * Rooms with feature_toggles.threshold_alerts === false skip evaluation
 * entirely — per-room features gate behaviour, not just UI.
 *
 * Server-only (DB access).
 */

import { and, desc, eq, gt, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  alertRules,
  alerts,
  sensorReadings,
  storerooms,
} from '@/drizzle/storerooms-schema';
import type { Tx } from '@/lib/db/context';
import type { SensorMetric } from './room-types';

/** A queryable scope — the db client or an open transaction. */
type Queryable = Pick<typeof db, 'select' | 'insert' | 'execute'> | Tx;

export interface ReadingPoint {
  roomId: string;
  metric: SensorMetric;
  value: number;
  recordedAt: Date;
}

/** SQL fragment: does the sensor_readings.value column breach the rule? */
function breachCondition(op: 'above' | 'below', threshold: number): SQL {
  return op === 'above'
    ? sql`${sensorReadings.value} > ${String(threshold)}`
    : sql`${sensorReadings.value} < ${String(threshold)}`;
}

/**
 * Sustained-breach check for dwell > 0 rules.
 *
 * Finds the most recent NON-breaching reading at or before `at`, then the
 * earliest breaching reading after it — the start of the current breach
 * streak. Returns true when the streak covers at least `dwellMinutes`.
 */
async function isSustainedBreach(
  q: Queryable,
  rule: {
    roomId: string;
    metric: SensorMetric;
    op: 'above' | 'below';
    threshold: number;
    dwellMinutes: number;
  },
  at: Date,
): Promise<boolean> {
  const breach = breachCondition(rule.op, rule.threshold);

  const lastOk = await q
    .select({ recordedAt: sensorReadings.recordedAt })
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.roomId, rule.roomId),
        eq(sensorReadings.metric, rule.metric),
        lte(sensorReadings.recordedAt, at),
        sql`NOT (${breach})`,
      ),
    )
    .orderBy(desc(sensorReadings.recordedAt))
    .limit(1);

  const streakStart = await q
    .select({
      since: sql<string | null>`min(${sensorReadings.recordedAt})`,
    })
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.roomId, rule.roomId),
        eq(sensorReadings.metric, rule.metric),
        lte(sensorReadings.recordedAt, at),
        lastOk[0] ? gt(sensorReadings.recordedAt, lastOk[0].recordedAt) : undefined,
        breach,
      ),
    );

  const since = streakStart[0]?.since;
  if (!since) return false;
  const elapsedMs = at.getTime() - new Date(since).getTime();
  return elapsedMs >= rule.dwellMinutes * 60_000;
}

/**
 * Evaluate all active rules for a batch of freshly inserted readings.
 * Returns the number of alerts opened.
 */
export async function evaluateRulesForReadings(
  q: Queryable,
  readings: ReadingPoint[],
): Promise<number> {
  if (readings.length === 0) return 0;

  const roomIds = [...new Set(readings.map((r) => r.roomId))];
  const metrics = [...new Set(readings.map((r) => r.metric))];

  // Rooms with threshold_alerts explicitly disabled skip evaluation.
  const roomRows = await q
    .select({ id: storerooms.id, featureToggles: storerooms.featureToggles })
    .from(storerooms)
    .where(inArray(storerooms.id, roomIds));
  const enabledRooms = new Set(
    roomRows
      .filter((r) => r.featureToggles?.threshold_alerts !== false)
      .map((r) => r.id),
  );

  const rules = await q
    .select()
    .from(alertRules)
    .where(
      and(
        inArray(alertRules.roomId, roomIds),
        inArray(alertRules.metric, metrics),
        eq(alertRules.active, true),
      ),
    );
  if (rules.length === 0) return 0;

  // Latest reading per (room, metric) — only the freshest point in the batch
  // can satisfy a dwell window ending "now".
  const latest = new Map<string, ReadingPoint>();
  for (const r of readings) {
    const key = `${r.roomId}:${r.metric}`;
    const prev = latest.get(key);
    if (!prev || prev.recordedAt < r.recordedAt) latest.set(key, r);
  }

  let opened = 0;
  for (const rule of rules) {
    if (!enabledRooms.has(rule.roomId)) continue;

    const point = latest.get(`${rule.roomId}:${rule.metric}`);
    if (!point) continue;

    const threshold = Number(rule.threshold);
    const breaches =
      rule.op === 'above' ? point.value > threshold : point.value < threshold;
    if (!breaches) continue;

    // Deduplicate: skip when a live alert already exists for this rule.
    const live = await q
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.ruleId, rule.id),
          inArray(alerts.state, ['active', 'acknowledged']),
        ),
      )
      .limit(1);
    if (live.length > 0) continue;

    const sustained =
      rule.dwellMinutes <= 0
        ? true
        : await isSustainedBreach(
            q,
            {
              roomId: rule.roomId,
              metric: rule.metric,
              op: rule.op,
              threshold,
              dwellMinutes: rule.dwellMinutes,
            },
            point.recordedAt,
          );
    if (!sustained) continue;

    // onConflictDoNothing: no target → swallows a partial-unique-index race
    // (two concurrent ingests passing the dedupe check simultaneously).
    const inserted = await q
      .insert(alerts)
      .values({
        ruleId: rule.id,
        roomId: rule.roomId,
        metric: rule.metric,
        value: String(point.value),
        openedAt: point.recordedAt,
      })
      .onConflictDoNothing()
      .returning({ id: alerts.id });
    opened += inserted.length;
  }

  return opened;
}
