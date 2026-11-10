/**
 * drizzle/storerooms-schema — typed interface for the 0003_storerooms
 * migration (storerooms, sensor_readings, alert_rules, alerts, and the
 * bin_locations.room_id column).
 *
 * Kept in a SEPARATE file from drizzle/schema.ts because that file mirrors
 * the supabase/migrations baseline exactly and is owned by another work
 * stream. This file is imported directly wherever these tables are queried:
 *
 *   import { storerooms } from '@/drizzle/storerooms-schema';
 *   await db.select().from(storerooms) ...
 *
 * (The `db` client's `schema` registry is only needed for the relational
 * db.query.* API — plain query-builder calls take the table object, so no
 * change to lib/db/index.ts is required.)
 *
 * `numeric`/`decimal` columns map to `string` under postgres.js — convert to
 * `number` at the DTO boundary (see lib/storerooms/types.ts).
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { profiles } from './schema';

// ============================================================================
// ENUMS (labels must match 0003_storerooms.sql exactly)
// ============================================================================

export const roomTypeEnum = pgEnum('room_type', [
  'general',
  'cold',
  'frozen',
  'dry',
  'it',
  'vehicle',
  'secure',
  'hazmat',
  'quarantine',
  'staging',
  'dock',
  'returns',
  'destruction',
]);

export const roomAccessLevelEnum = pgEnum('room_access_level', [
  'open',
  'restricted',
  'secure',
  'locked',
]);

export const sensorMetricEnum = pgEnum('sensor_metric', [
  'temperature',
  'humidity',
  'door',
  'vibration',
  'motion',
  'gas',
]);

export const alertThresholdOpEnum = pgEnum('alert_threshold_op', [
  'above',
  'below',
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
  'info',
  'warning',
  'critical',
]);

export const alertStateEnum = pgEnum('alert_state', [
  'active',
  'acknowledged',
  'resolved',
]);

// ============================================================================
// TABLES
// ============================================================================

export const storerooms = pgTable(
  'storerooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: roomTypeEnum('type').notNull().default('general'),
    parentId: uuid('parent_id').references((): AnyPgColumn => storerooms.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    tempMin: numeric('temp_min', { precision: 8, scale: 2 }),
    tempMax: numeric('temp_max', { precision: 8, scale: 2 }),
    capacityUnits: integer('capacity_units'),
    accessLevel: roomAccessLevelEnum('access_level').notNull().default('open'),
    allowedRoles: text('allowed_roles')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    itemAllowlist: text('item_allowlist')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    featureToggles: jsonb('feature_toggles')
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    quarantine: boolean('quarantine').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_storerooms_parent').on(t.parentId),
    index('idx_storerooms_type').on(t.type),
    index('idx_storerooms_active').on(t.active),
  ],
);

/**
 * Shadow declaration of public.bin_locations exposing only the columns this
 * feature needs — including room_id, which 0003 adds but drizzle/schema.ts
 * (owned by another stream) doesn't know about. Same underlying table; the
 * canonical full definition remains in drizzle/schema.ts.
 */
export const binLocationRooms = pgTable(
  'bin_locations',
  {
    id: uuid('id').primaryKey(),
    zone: text('zone').notNull(),
    binLocation: text('bin_location').notNull(),
    roomId: uuid('room_id'),
  },
  (t) => [index('idx_bin_locations_room').on(t.roomId)],
);

export const sensorReadings = pgTable(
  'sensor_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references((): AnyPgColumn => storerooms.id, { onDelete: 'cascade' }),
    metric: sensorMetricEnum('metric').notNull(),
    value: numeric('value', { precision: 15, scale: 4 }).notNull(),
    unit: text('unit').notNull(),
    deviceId: text('device_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Idempotency key — ON CONFLICT DO NOTHING in the ingest path.
    uniqueIndex('sensor_readings_idempotency_key').on(
      t.roomId,
      t.deviceId,
      t.metric,
      t.recordedAt,
    ),
    index('idx_sensor_readings_room_time').on(t.roomId, t.recordedAt),
    index('idx_sensor_readings_metric_time').on(t.metric, t.recordedAt),
  ],
);

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references((): AnyPgColumn => storerooms.id, { onDelete: 'cascade' }),
    metric: sensorMetricEnum('metric').notNull(),
    op: alertThresholdOpEnum('op').notNull(),
    threshold: numeric('threshold', { precision: 15, scale: 4 }).notNull(),
    dwellMinutes: integer('dwell_minutes').notNull().default(0),
    severity: alertSeverityEnum('severity').notNull().default('warning'),
    notifyRoles: text('notify_roles')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_alert_rules_room').on(t.roomId),
    index('idx_alert_rules_active').on(t.active),
  ],
);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id').references((): AnyPgColumn => alertRules.id, {
      onDelete: 'set null',
    }),
    roomId: uuid('room_id')
      .notNull()
      .references((): AnyPgColumn => storerooms.id, { onDelete: 'cascade' }),
    metric: sensorMetricEnum('metric').notNull(),
    value: numeric('value', { precision: 15, scale: 4 }).notNull(),
    state: alertStateEnum('state').notNull().default('active'),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ackedBy: uuid('acked_by').references((): AnyPgColumn => profiles.id, {
      onDelete: 'set null',
    }),
    ackedAt: timestamp('acked_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_alerts_room').on(t.roomId),
    index('idx_alerts_state').on(t.state),
    index('idx_alerts_opened').on(t.openedAt),
    // One live (active|acknowledged) alert per rule — matches 0003's
    // uq_alerts_one_open_per_rule partial unique index.
    uniqueIndex('uq_alerts_one_open_per_rule')
      .on(t.ruleId)
      .where(sql`${t.ruleId} IS NOT NULL AND ${t.state} IN ('active','acknowledged')`),
  ],
);

// Row types (numeric columns are string under postgres.js).
export type StoreroomRow = typeof storerooms.$inferSelect;
export type SensorReadingRow = typeof sensorReadings.$inferSelect;
export type AlertRuleRow = typeof alertRules.$inferSelect;
export type AlertRow = typeof alerts.$inferSelect;
