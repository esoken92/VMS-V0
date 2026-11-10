'use server';

/**
 * lib/actions/storerooms — room CRUD + room contents + toggle/access editors.
 *
 * Authorization (server-side, every call):
 *   reads   → requireUser()           (any authenticated role, staff+)
 *   writes  → requireRole(admin+manager incl. super_admin)
 *
 * Mutations run inside a transaction with setAuditContext so the DB audit
 * trigger attributes storerooms changes to the effective user.
 */

import { asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '@/lib/db';
import { executeRows } from '@/lib/db/rows';
import { products } from '@/drizzle/schema';
import {
  alerts,
  binLocationRooms,
  storerooms,
} from '@/drizzle/storerooms-schema';
import { setAuditContext } from '@/lib/db/context';
import { requireRole, requireUser } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import {
  ROOM_ACCESS_LEVELS,
  ROOM_FEATURE_KEYS,
  ROOM_TYPES,
} from '@/lib/storerooms/room-types';
import type {
  RoomContentItemDTO,
  RoomDTO,
  RoomListItemDTO,
  RoomOptionDTO,
} from '@/lib/storerooms/types';

const ROOM_WRITE_ROLES = ['super_admin', 'admin', 'manager'] as const;

type StoreroomSelect = typeof storerooms.$inferSelect;

function toRoomDTO(
  r: StoreroomSelect,
  parentName: string | null = null,
): RoomDTO {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    parent_id: r.parentId,
    parent_name: parentName,
    description: r.description,
    temp_min: r.tempMin === null ? null : Number(r.tempMin),
    temp_max: r.tempMax === null ? null : Number(r.tempMax),
    capacity_units: r.capacityUnits,
    access_level: r.accessLevel,
    allowed_roles: r.allowedRoles,
    item_allowlist: r.itemAllowlist,
    feature_toggles: r.featureToggles ?? {},
    quarantine: r.quarantine,
    active: r.active,
    created_at: r.createdAt?.toISOString() ?? null,
    updated_at: r.updatedAt?.toISOString() ?? null,
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

/** Keep only known feature keys — feature_toggles is a closed catalog. */
function sanitizeToggles(raw: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of ROOM_FEATURE_KEYS) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  return out;
}

// ============================================================================
// READS
// ============================================================================

/** Rooms for list views + pickers, with occupancy/climate/alert rollups. */
export async function listRooms(): Promise<Result<RoomListItemDTO[]>> {
  try {
    await requireUser();
    const parent = alias(storerooms, 'parent');

    const [rooms, childCounts, binCounts, stockRows, latestTempsRes, alertCounts] =
      await Promise.all([
        db
          .select({ room: storerooms, parentName: parent.name })
          .from(storerooms)
          .leftJoin(parent, eq(storerooms.parentId, parent.id))
          .orderBy(asc(storerooms.name)),
        // Child counts
        db
          .select({
            parentId: storerooms.parentId,
            count: sql<number>`count(*)`,
          })
          .from(storerooms)
          .where(sql`${storerooms.parentId} IS NOT NULL`)
          .groupBy(storerooms.parentId),
        // Bin counts per room
        db
          .select({
            roomId: binLocationRooms.roomId,
            count: sql<number>`count(*)`,
          })
          .from(binLocationRooms)
          .where(sql`${binLocationRooms.roomId} IS NOT NULL`)
          .groupBy(binLocationRooms.roomId),
        // Product counts + stock units via products.bin_location_id → room_id
        db
          .select({
            roomId: binLocationRooms.roomId,
            productCount: sql<number>`count(${products.id})`,
            stockUnits: sql<string>`coalesce(sum(${products.currentStock}), 0)`,
          })
          .from(products)
          .innerJoin(
            binLocationRooms,
            eq(products.binLocationId, binLocationRooms.id),
          )
          .where(sql`${binLocationRooms.roomId} IS NOT NULL`)
          .groupBy(binLocationRooms.roomId),
        // Latest temperature reading per room (DISTINCT ON is Postgres-native).
        // db.execute() returns array rows on postgres.js but {rows} on the
        // PGlite socket path — normalize both shapes.
        db.execute<{
          room_id: string;
          value: string;
          recorded_at: Date;
        }>(sql`
          SELECT DISTINCT ON (room_id) room_id, value, recorded_at
          FROM sensor_readings
          WHERE metric = 'temperature'
          ORDER BY room_id, recorded_at DESC
        `),
        // Open (active|acknowledged) alert counts per room
        db
          .select({ roomId: alerts.roomId, count: sql<number>`count(*)` })
          .from(alerts)
          .where(inArray(alerts.state, ['active', 'acknowledged']))
          .groupBy(alerts.roomId),
      ]);
    const childMap = new Map(
      childCounts.map((r) => [r.parentId as string, Number(r.count)]),
    );
    const binMap = new Map(
      binCounts.map((r) => [r.roomId as string, Number(r.count)]),
    );
    const stockMap = new Map(
      stockRows.map((r) => [
        r.roomId as string,
        { count: Number(r.productCount), units: Number(r.stockUnits) },
      ]),
    );
    const latestTemps = executeRows<{
      room_id: string;
      value: string;
      recorded_at: Date;
    }>(latestTempsRes);
    const tempMap = new Map(
      latestTemps.map((r) => [
        r.room_id,
        { value: Number(r.value), at: new Date(r.recorded_at) },
      ]),
    );
    const alertMap = new Map(
      alertCounts.map((r) => [r.roomId, Number(r.count)]),
    );

    const items: RoomListItemDTO[] = rooms.map(({ room, parentName }) => {
      const dto = toRoomDTO(room, parentName);
      const temp = tempMap.get(room.id) ?? null;
      const stock = stockMap.get(room.id);
      const min = dto.temp_min;
      const max = dto.temp_max;
      return {
        ...dto,
        child_count: childMap.get(room.id) ?? 0,
        bin_count: binMap.get(room.id) ?? 0,
        product_count: stock?.count ?? 0,
        stock_units: stock?.units ?? 0,
        latest_temp: temp?.value ?? null,
        latest_temp_at: temp?.at.toISOString() ?? null,
        temp_status: tempStatus(temp?.value ?? null, min, max),
        open_alert_count: alertMap.get(room.id) ?? 0,
      };
    });

    return ok(items);
  } catch (err) {
    return actionError(err);
  }
}

/** Single room + parent name + child rooms. */
export async function getRoom(id: string): Promise<
  Result<{ room: RoomDTO; children: RoomOptionDTO[] }>
> {
  try {
    await requireUser();
    const parsed = z.string().uuid().parse(id);
    const parent = alias(storerooms, 'parent');

    const rows = await db
      .select({ room: storerooms, parentName: parent.name })
      .from(storerooms)
      .leftJoin(parent, eq(storerooms.parentId, parent.id))
      .where(eq(storerooms.id, parsed))
      .limit(1);
    if (!rows[0]) return fail('Room not found', 'NOT_FOUND');

    const children = await db
      .select({ id: storerooms.id, name: storerooms.name, type: storerooms.type })
      .from(storerooms)
      .where(eq(storerooms.parentId, parsed))
      .orderBy(asc(storerooms.name));

    return ok({
      room: toRoomDTO(rows[0].room, rows[0].parentName),
      children,
    });
  } catch (err) {
    return actionError(err);
  }
}

/** id+name+type list for parent pickers and the monitoring room selector. */
export async function listRoomOptions(): Promise<Result<RoomOptionDTO[]>> {
  try {
    await requireUser();
    const rows = await db
      .select({ id: storerooms.id, name: storerooms.name, type: storerooms.type })
      .from(storerooms)
      .where(eq(storerooms.active, true))
      .orderBy(asc(storerooms.name));
    return ok(rows);
  } catch (err) {
    return actionError(err);
  }
}

/** Products located in the room via bin_locations.room_id linkage. */
export async function getRoomContents(
  roomId: string,
): Promise<Result<RoomContentItemDTO[]>> {
  try {
    await requireUser();
    const id = z.string().uuid().parse(roomId);
    const rows = await db
      .select({
        product_id: products.id,
        sku: products.sku,
        name: products.name,
        item_type: products.itemType,
        current_stock: products.currentStock,
        unit_of_measure: products.unitOfMeasure,
        bin_label: sql<string>`${binLocationRooms.zone} || '-' || ${binLocationRooms.binLocation}`,
      })
      .from(products)
      .innerJoin(
        binLocationRooms,
        eq(products.binLocationId, binLocationRooms.id),
      )
      .where(eq(binLocationRooms.roomId, id))
      .orderBy(asc(products.name))
      .limit(500);

    return ok(
      rows.map((r) => ({ ...r, current_stock: Number(r.current_stock) })),
    );
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// WRITES
// ============================================================================

const roomInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200),
    type: z.enum(ROOM_TYPES),
    parent_id: z.string().uuid().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    temp_min: z.number().min(-100).max(300).nullable().optional(),
    temp_max: z.number().min(-100).max(300).nullable().optional(),
    capacity_units: z.number().int().min(0).max(1_000_000).nullable().optional(),
    access_level: z.enum(ROOM_ACCESS_LEVELS).default('open'),
    allowed_roles: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    item_allowlist: z
      .array(z.string().trim().min(1).max(100))
      .max(100)
      .default([]),
    feature_toggles: z.record(z.string(), z.boolean()).default({}),
    quarantine: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine(
    (d) =>
      d.temp_min === null ||
      d.temp_min === undefined ||
      d.temp_max === null ||
      d.temp_max === undefined ||
      d.temp_min <= d.temp_max,
    { message: 'temp_min must be less than or equal to temp_max' },
  );

/**
 * Cycle guard for the parent hierarchy: walking ancestors from parent_id
 * must never reach `selfId`. Bounded at depth 50 — deeper is a bug, not a
 * hierarchy.
 */
async function wouldCreateCycle(
  selfId: string,
  parentId: string | null,
): Promise<boolean> {
  let cursor = parentId;
  for (let depth = 0; cursor && depth < 50; depth++) {
    if (cursor === selfId) return true;
    const rows = await db
      .select({ parentId: storerooms.parentId })
      .from(storerooms)
      .where(eq(storerooms.id, cursor))
      .limit(1);
    cursor = rows[0]?.parentId ?? null;
  }
  return cursor === selfId;
}

export async function upsertRoom(input: unknown): Promise<Result<RoomDTO>> {
  try {
    const ctx = await requireRole([...ROOM_WRITE_ROLES]);
    const data = roomInputSchema.parse(input);

    if (data.parent_id) {
      if (data.id && data.parent_id === data.id) {
        return fail('A room cannot be its own parent', 'VALIDATION');
      }
      const parent = await db
        .select({ id: storerooms.id })
        .from(storerooms)
        .where(eq(storerooms.id, data.parent_id))
        .limit(1);
      if (!parent[0]) return fail('Parent room not found', 'VALIDATION');
      if (data.id && (await wouldCreateCycle(data.id, data.parent_id))) {
        return fail('Parent selection would create a cycle', 'VALIDATION');
      }
    }

    const values = {
      name: data.name,
      type: data.type,
      parentId: data.parent_id ?? null,
      description: data.description ?? null,
      tempMin: data.temp_min === null || data.temp_min === undefined ? null : String(data.temp_min),
      tempMax: data.temp_max === null || data.temp_max === undefined ? null : String(data.temp_max),
      capacityUnits: data.capacity_units ?? null,
      accessLevel: data.access_level,
      allowedRoles: data.allowed_roles,
      itemAllowlist: data.item_allowlist,
      featureToggles: sanitizeToggles(data.feature_toggles),
      quarantine: data.quarantine,
      active: data.active,
      updatedAt: new Date(),
    };

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      if (data.id) {
        const [row] = await tx
          .update(storerooms)
          .set(values)
          .where(eq(storerooms.id, data.id))
          .returning();
        return row ?? null;
      }
      const [row] = await tx.insert(storerooms).values(values).returning();
      return row ?? null;
    });

    if (!saved) return fail('Room not found', 'NOT_FOUND');
    return ok(toRoomDTO(saved));
  } catch (err) {
    return actionError(err);
  }
}

/** Merge a partial set of feature toggles (known keys only). */
export async function updateRoomToggles(
  roomId: string,
  toggles: Record<string, boolean>,
): Promise<Result<RoomDTO>> {
  try {
    const ctx = await requireRole([...ROOM_WRITE_ROLES]);
    const id = z.string().uuid().parse(roomId);
    const patch = sanitizeToggles(
      z.record(z.string(), z.boolean()).parse(toggles),
    );

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const existing = await tx
        .select({ featureToggles: storerooms.featureToggles })
        .from(storerooms)
        .where(eq(storerooms.id, id))
        .limit(1);
      if (!existing[0]) return null;
      const merged = { ...(existing[0].featureToggles ?? {}), ...patch };
      const [row] = await tx
        .update(storerooms)
        .set({ featureToggles: merged, updatedAt: new Date() })
        .where(eq(storerooms.id, id))
        .returning();
      return row ?? null;
    });

    if (!saved) return fail('Room not found', 'NOT_FOUND');
    return ok(toRoomDTO(saved));
  } catch (err) {
    return actionError(err);
  }
}

/** Access level + role/allowlist editors (manager+). */
export async function updateRoomAccess(
  roomId: string,
  input: unknown,
): Promise<Result<RoomDTO>> {
  try {
    const ctx = await requireRole([...ROOM_WRITE_ROLES]);
    const id = z.string().uuid().parse(roomId);
    const data = z
      .object({
        access_level: z.enum(ROOM_ACCESS_LEVELS),
        allowed_roles: z.array(z.string().trim().min(1).max(50)).max(20),
        item_allowlist: z.array(z.string().trim().min(1).max(100)).max(100),
      })
      .parse(input);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [row] = await tx
        .update(storerooms)
        .set({
          accessLevel: data.access_level,
          allowedRoles: data.allowed_roles,
          itemAllowlist: data.item_allowlist,
          updatedAt: new Date(),
        })
        .where(eq(storerooms.id, id))
        .returning();
      return row ?? null;
    });

    if (!saved) return fail('Room not found', 'NOT_FOUND');
    return ok(toRoomDTO(saved));
  } catch (err) {
    return actionError(err);
  }
}

/** Activate/deactivate a room (no hard delete — audit + history safety). */
export async function setRoomActive(
  roomId: string,
  active: boolean,
): Promise<Result<RoomDTO>> {
  try {
    const ctx = await requireRole([...ROOM_WRITE_ROLES]);
    const id = z.string().uuid().parse(roomId);
    const flag = z.boolean().parse(active);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [row] = await tx
        .update(storerooms)
        .set({ active: flag, updatedAt: new Date() })
        .where(eq(storerooms.id, id))
        .returning();
      return row ?? null;
    });

    if (!saved) return fail('Room not found', 'NOT_FOUND');
    return ok(toRoomDTO(saved));
  } catch (err) {
    return actionError(err);
  }
}

/** Link an existing bin location to a room (manager+). */
export async function assignBinToRoom(
  binLocationId: string,
  roomId: string | null,
): Promise<Result<null>> {
  try {
    const ctx = await requireRole([...ROOM_WRITE_ROLES]);
    const binId = z.string().uuid().parse(binLocationId);
    const rid =
      roomId === null ? null : z.string().uuid().parse(roomId);

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      // binLocationRooms is the shadow table exposing the room_id column
      // that drizzle/schema.ts doesn't declare (0003 adds it).
      await tx
        .update(binLocationRooms)
        .set({ roomId: rid })
        .where(eq(binLocationRooms.id, binId));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
