'use server';

/**
 * lib/actions/sensors — readings for charts, alert lifecycle, alert-rule CRUD,
 * and the monitoring dashboard's per-room status rollup.
 *
 * Authorization (server-side, every call):
 *   reads                    → requireUser()  (any authenticated role)
 *   ack/resolve + rule writes → manager+ (super_admin/admin/manager)
 *
 * Device ingestion lives in app/api/sensors/ingest (Bearer key or session)
 * and lib/storerooms/ingest.ts — not here.
 */

import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { executeRows } from '@/lib/db/rows';
import { profiles } from '@/drizzle/schema';
import {
  alertRules,
  alerts,
  sensorReadings,
  storerooms,
} from '@/drizzle/storerooms-schema';
import { setAuditContext } from '@/lib/db/context';
import { requireRole, requireUser } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import {
  ALERT_SEVERITIES,
  ALERT_STATES,
  ALERT_THRESHOLD_OPS,
  SENSOR_METRICS,
} from '@/lib/storerooms/room-types';
import type {
  AlertDTO,
  AlertRuleDTO,
  RoomStatusDTO,
  SensorReadingDTO,
} from '@/lib/storerooms/types';

const MANAGER_UP = ['super_admin', 'admin', 'manager'] as const;

function toReadingDTO(r: typeof sensorReadings.$inferSelect): SensorReadingDTO {
  return {
    id: r.id,
    room_id: r.roomId,
    metric: r.metric,
    value: Number(r.value),
    unit: r.unit,
    device_id: r.deviceId,
    recorded_at: r.recordedAt.toISOString(),
    ingested_at: r.ingestedAt.toISOString(),
  };
}

function tempStatus(
  temp: number | null,
  min: number | null,
  max: number | null,
): 'ok' | 'low' | 'high' | 'unknown' {
  if (temp === null) return 'unknown';
  if (min !== null && temp < min) return 'low';
  if (max !== null && temp > max) return 'high';
  return 'ok';
}

// ============================================================================
// READINGS (charts)
// ============================================================================

const readingsQuerySchema = z.object({
  room_id: z.string().uuid(),
  metric: z.enum(SENSOR_METRICS).optional(),
  hours: z.number().min(0.25).max(24 * 30).default(24),
  limit: z.number().int().min(1).max(5000).default(2000),
});

/** Readings for one room, ascending — chart-ready series. */
export async function getRoomReadings(
  input: unknown,
): Promise<Result<SensorReadingDTO[]>> {
  try {
    await requireUser();
    const q = readingsQuerySchema.parse(input);
    const since = new Date(Date.now() - q.hours * 3_600_000);

    const rows = await db
      .select()
      .from(sensorReadings)
      .where(
        and(
          eq(sensorReadings.roomId, q.room_id),
          q.metric ? eq(sensorReadings.metric, q.metric) : undefined,
          gte(sensorReadings.recordedAt, since),
        ),
      )
      .orderBy(asc(sensorReadings.recordedAt))
      .limit(q.limit);

    return ok(rows.map(toReadingDTO));
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// MONITORING ROLLUP — one status row per active room
// ============================================================================

export async function listRoomStatuses(): Promise<Result<RoomStatusDTO[]>> {
  try {
    await requireUser();

    const [rooms, latestRes, latestAnyRes, alertCounts] = await Promise.all([
      db
        .select({
          id: storerooms.id,
          name: storerooms.name,
          type: storerooms.type,
          tempMin: storerooms.tempMin,
          tempMax: storerooms.tempMax,
        })
        .from(storerooms)
        .where(eq(storerooms.active, true))
        .orderBy(asc(storerooms.name)),
      // Latest temperature + humidity + overall latest reading per room.
      db.execute(sql`
        SELECT DISTINCT ON (room_id, metric) room_id, metric, value, recorded_at
        FROM sensor_readings
        WHERE metric IN ('temperature', 'humidity')
        ORDER BY room_id, metric, recorded_at DESC
      `),
      db.execute(sql`
        SELECT DISTINCT ON (room_id) room_id, recorded_at
        FROM sensor_readings
        ORDER BY room_id, recorded_at DESC
      `),
      db
        .select({ roomId: alerts.roomId, count: sql<number>`count(*)` })
        .from(alerts)
        .where(inArray(alerts.state, ['active', 'acknowledged']))
        .groupBy(alerts.roomId),
    ]);
    const latest = executeRows<{
      room_id: string;
      metric: string;
      value: string;
      recorded_at: Date;
    }>(latestRes);
    const latestAny = executeRows<{ room_id: string; recorded_at: Date }>(latestAnyRes);
    const tempMap = new Map<string, number>();
    const humMap = new Map<string, number>();
    for (const r of latest) {
      if (r.metric === 'temperature') tempMap.set(r.room_id, Number(r.value));
      if (r.metric === 'humidity') humMap.set(r.room_id, Number(r.value));
    }
    const lastSeenMap = new Map(
      latestAny.map((r) => [r.room_id, new Date(r.recorded_at)]),
    );
    const alertMap = new Map(alertCounts.map((r) => [r.roomId, Number(r.count)]));

    const now = Date.now();
    return ok(
      rooms.map((room) => {
        const temp = tempMap.get(room.id) ?? null;
        const min = room.tempMin === null ? null : Number(room.tempMin);
        const max = room.tempMax === null ? null : Number(room.tempMax);
        const lastSeen = lastSeenMap.get(room.id) ?? null;
        return {
          room_id: room.id,
          room_name: room.name,
          type: room.type,
          temp_min: min,
          temp_max: max,
          latest_temp: temp,
          latest_humidity: humMap.get(room.id) ?? null,
          last_reading_at: lastSeen?.toISOString() ?? null,
          minutes_since_reading: lastSeen
            ? Math.round((now - lastSeen.getTime()) / 60_000)
            : null,
          temp_status: tempStatus(temp, min, max),
          open_alert_count: alertMap.get(room.id) ?? 0,
        };
      }),
    );
  } catch (err) {
    return actionError(err);
  }
}

/** Rooms with no reading in the last `minutes` (stale sensors). */
export async function listStaleRooms(
  minutes: number,
): Promise<Result<RoomStatusDTO[]>> {
  try {
    await requireUser();
    const staleMin = z.number().min(1).max(24 * 60).parse(minutes);
    const res = await listRoomStatuses();
    if (!res.success) return res;
    return ok(
      res.data.filter(
        (r) =>
          r.minutes_since_reading === null ||
          r.minutes_since_reading >= staleMin,
      ),
    );
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// ALERTS — list + lifecycle
// ============================================================================

const alertFilterSchema = z.object({
  state: z.enum(ALERT_STATES).optional(),
  room_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export async function listAlerts(input: unknown): Promise<Result<AlertDTO[]>> {
  try {
    await requireUser();
    const f = alertFilterSchema.parse(input ?? {});

    const rows = await db
      .select({
        alert: alerts,
        roomName: storerooms.name,
        ackedByName: profiles.fullName,
      })
      .from(alerts)
      .leftJoin(storerooms, eq(alerts.roomId, storerooms.id))
      .leftJoin(profiles, eq(alerts.ackedBy, profiles.id))
      .where(
        and(
          f.state ? eq(alerts.state, f.state) : undefined,
          f.room_id ? eq(alerts.roomId, f.room_id) : undefined,
        ),
      )
      .orderBy(desc(alerts.openedAt))
      .limit(f.limit);

    return ok(
      rows.map(({ alert: a, roomName, ackedByName }) => ({
        id: a.id,
        rule_id: a.ruleId,
        room_id: a.roomId,
        room_name: roomName,
        metric: a.metric,
        value: Number(a.value),
        state: a.state,
        opened_at: a.openedAt.toISOString(),
        acked_by: a.ackedBy,
        acked_by_name: ackedByName,
        acked_at: a.ackedAt?.toISOString() ?? null,
        resolved_at: a.resolvedAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

/** Fetch one alert as a DTO with room + acked-by names joined in. */
async function alertDTOById(alertId: string): Promise<AlertDTO | null> {
  const [row] = await db
    .select({
      alert: alerts,
      roomName: storerooms.name,
      ackedByName: profiles.fullName,
    })
    .from(alerts)
    .leftJoin(storerooms, eq(alerts.roomId, storerooms.id))
    .leftJoin(profiles, eq(alerts.ackedBy, profiles.id))
    .where(eq(alerts.id, alertId))
    .limit(1);
  if (!row) return null;
  const { alert: a, roomName, ackedByName } = row;
  return {
    id: a.id,
    rule_id: a.ruleId,
    room_id: a.roomId,
    room_name: roomName,
    metric: a.metric,
    value: Number(a.value),
    state: a.state,
    opened_at: a.openedAt.toISOString(),
    acked_by: a.ackedBy,
    acked_by_name: ackedByName,
    acked_at: a.ackedAt?.toISOString() ?? null,
    resolved_at: a.resolvedAt?.toISOString() ?? null,
  };
}

/** active → acknowledged. manager+. */
export async function acknowledgeAlert(id: string): Promise<Result<AlertDTO>> {
  try {
    const ctx = await requireRole([...MANAGER_UP]);
    const alertId = z.string().uuid().parse(id);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [row] = await tx
        .update(alerts)
        .set({
          state: 'acknowledged',
          ackedBy: ctx.user.id,
          ackedAt: new Date(),
        })
        .where(and(eq(alerts.id, alertId), eq(alerts.state, 'active')))
        .returning();
      return row ?? null;
    });
    if (!saved) return fail('Alert not found or not active', 'NOT_FOUND');

    const dto = await alertDTOById(saved.id);
    return dto ? ok(dto) : fail('Alert not found', 'NOT_FOUND');
  } catch (err) {
    return actionError(err);
  }
}

/** active|acknowledged → resolved. manager+. */
export async function resolveAlert(id: string): Promise<Result<AlertDTO>> {
  try {
    const ctx = await requireRole([...MANAGER_UP]);
    const alertId = z.string().uuid().parse(id);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [row] = await tx
        .update(alerts)
        .set({ state: 'resolved', resolvedAt: new Date() })
        .where(
          and(
            eq(alerts.id, alertId),
            inArray(alerts.state, ['active', 'acknowledged']),
          ),
        )
        .returning();
      return row ?? null;
    });
    if (!saved) return fail('Alert not found or already resolved', 'NOT_FOUND');

    const dto = await alertDTOById(saved.id);
    return dto ? ok(dto) : fail('Alert not found', 'NOT_FOUND');
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// ALERT RULES
// ============================================================================

export async function listAlertRules(
  roomId?: string,
): Promise<Result<AlertRuleDTO[]>> {
  try {
    await requireUser();
    const rid = roomId ? z.string().uuid().parse(roomId) : undefined;

    const rows = await db
      .select({ rule: alertRules, roomName: storerooms.name })
      .from(alertRules)
      .leftJoin(storerooms, eq(alertRules.roomId, storerooms.id))
      .where(rid ? eq(alertRules.roomId, rid) : undefined)
      .orderBy(asc(alertRules.createdAt));

    return ok(
      rows.map(({ rule: r, roomName }) => ({
        id: r.id,
        room_id: r.roomId,
        room_name: roomName,
        metric: r.metric,
        op: r.op,
        threshold: Number(r.threshold),
        dwell_minutes: r.dwellMinutes,
        severity: r.severity,
        notify_roles: r.notifyRoles,
        active: r.active,
        created_at: r.createdAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const ruleInputSchema = z.object({
  id: z.string().uuid().optional(),
  room_id: z.string().uuid(),
  metric: z.enum(SENSOR_METRICS),
  op: z.enum(ALERT_THRESHOLD_OPS),
  threshold: z.number().min(-1_000_000).max(1_000_000),
  dwell_minutes: z.number().int().min(0).max(24 * 60).default(0),
  severity: z.enum(ALERT_SEVERITIES).default('warning'),
  notify_roles: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  active: z.boolean().default(true),
});

export async function upsertAlertRule(
  input: unknown,
): Promise<Result<AlertRuleDTO>> {
  try {
    const ctx = await requireRole([...MANAGER_UP]);
    const data = ruleInputSchema.parse(input);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const values = {
        roomId: data.room_id,
        metric: data.metric,
        op: data.op,
        threshold: String(data.threshold),
        dwellMinutes: data.dwell_minutes,
        severity: data.severity,
        notifyRoles: data.notify_roles,
        active: data.active,
        updatedAt: new Date(),
      };
      if (data.id) {
        const [row] = await tx
          .update(alertRules)
          .set(values)
          .where(eq(alertRules.id, data.id))
          .returning({ id: alertRules.id, roomId: alertRules.roomId });
        return row ?? null;
      }
      const [row] = await tx
        .insert(alertRules)
        .values(values)
        .returning({ id: alertRules.id, roomId: alertRules.roomId });
      return row ?? null;
    });
    if (!saved) return fail('Alert rule not found', 'NOT_FOUND');

    const res = await listAlertRules(saved.roomId);
    const dto = res.success ? res.data.find((r) => r.id === saved.id) : null;
    return dto ? ok(dto) : fail('Rule saved but reload failed');
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteAlertRule(id: string): Promise<Result<null>> {
  try {
    const ctx = await requireRole([...MANAGER_UP]);
    const ruleId = z.string().uuid().parse(id);
    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx.delete(alertRules).where(eq(alertRules.id, ruleId));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
