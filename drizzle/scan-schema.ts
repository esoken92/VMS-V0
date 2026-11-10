/**
 * drizzle/scan-schema — typed defs for tables added by 0001_scan.sql.
 *
 * Lives in its own file (not ./schema.ts) so the scan feature stays a
 * self-contained delta. Tables here work with `db.select().from(...)`,
 * `db.insert(...)` etc. — the drizzle client only needs the base schema
 * for relational `db.query.*` helpers, which these don't use.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { profiles } from './schema';

export const SCAN_INPUT_TYPES = ['camera', 'hid', 'manual', 'rfid'] as const;
export type ScanInputType = (typeof SCAN_INPUT_TYPES)[number];

export const SCAN_ENTITY_TYPES = ['product', 'bin', 'take', 'tool'] as const;
export type ScanEntityType = (typeof SCAN_ENTITY_TYPES)[number];

export const scanEvents = pgTable(
  'scan_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    deviceLabel: text('device_label'),
    inputType: text('input_type').notNull().$type<ScanInputType>(),
    /** sha256 hex of the normalized input — never the raw payload. */
    rawHash: text('raw_hash').notNull(),
    resolvedEntityType: text('resolved_entity_type')
      .$type<ScanEntityType>(),
    resolvedEntityId: uuid('resolved_entity_id'),
    action: text('action').notNull(),
    locationContext: text('location_context'),
    flagged: boolean('flagged').notNull().default(false),
    flagReason: text('flag_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_scan_events_created_at').on(t.createdAt),
    index('idx_scan_events_entity').on(t.resolvedEntityType, t.resolvedEntityId),
    index('idx_scan_events_user').on(t.userId),
  ],
);

export const labelTokens = pgTable(
  'label_tokens',
  {
    /** sha256 hex of the complete token string (nonce-store key). */
    tokenHash: text('token_hash').primaryKey(),
    entityType: text('entity_type').notNull().$type<ScanEntityType>(),
    entityId: uuid('entity_id').notNull(),
    iat: timestamp('iat', { withTimezone: true }).notNull(),
    exp: timestamp('exp', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('idx_label_tokens_entity').on(t.entityType, t.entityId)],
);
