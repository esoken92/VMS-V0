/**
 * drizzle/api-schema — tables for the API/MCP surface that are NOT part of
 * the ported Supabase baseline schema (drizzle/schema.ts stays untouched —
 * it mirrors supabase/migrations/*.sql exactly).
 *
 * `api_keys` is applied by drizzle/0002_api_keys.sql. Keep this file in
 * sync with that SQL; it exists so lib/api/* gets the same typed query
 * interface as the rest of the app.
 *
 * scopes values: 'read' | 'write' | 'admin' (subsets only — enforced by
 * CHECK constraint api_keys_scopes_subset in the SQL).
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, unique, uuid, check } from 'drizzle-orm/pg-core';
import { profiles } from './schema';

export const API_SCOPES = ['read', 'write', 'admin'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** First 8 chars of the issued key — display/identification only. */
    keyPrefix: text('key_prefix').notNull(),
    /** sha256 hex of (MCP_API_KEY_SALT + ':' + key). Plaintext never stored. */
    keyHash: text('key_hash').notNull(),
    scopes: text('scopes').array().notNull().default(sql`'{read}'`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('api_keys_key_hash_unique').on(t.keyHash),
    index('idx_api_keys_user').on(t.userId),
    index('idx_api_keys_hash').on(t.keyHash),
    index('idx_api_keys_active').on(t.revokedAt).where(sql`${t.revokedAt} IS NULL`),
    check(
      'api_keys_scopes_subset',
      sql`${t.scopes} <@ ARRAY['read','write','admin']::text[]`,
    ),
  ],
);
