/**
 * drizzle/instance-config-schema — typed interface for the
 * 0004_instance_config migration (the `instance_config` key/value table).
 *
 * Kept in a SEPARATE file from drizzle/schema.ts because that file mirrors
 * the supabase/migrations baseline exactly and is owned by another work
 * stream. This file is imported directly wherever the table is queried:
 *
 *   import { instanceConfig } from '@/drizzle/instance-config-schema';
 *   await db.select().from(instanceConfig) ...
 *
 * `value` is a generic JSONB payload — the row's `key` determines the
 * shape. Known keys:
 *   'provisioning'           → ProvisioningConfig (lib/features.ts)
 *   'product_tracking.<id>'  → ProductTrackingAttributes
 * Always Zod-parse `value` at the boundary (lib/actions/provisioning.ts).
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { profiles } from './schema';

export const instanceConfig = pgTable('instance_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: jsonb('value')
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => profiles.id, {
    onDelete: 'set null',
  }),
});

export type InstanceConfigRow = typeof instanceConfig.$inferSelect;
