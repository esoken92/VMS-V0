/**
 * lib/db — postgres.js driver + drizzle client.
 *
 * postgres.js works in both Node and edge runtimes (used by server actions
 * and — if ever needed — edge middleware). The pool is shared per-process.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://vms:vms_local_dev@localhost:5432/vms';

// Global singleton so Next dev hot-reloads don't exhaust connections.
const globalForDb = globalThis as unknown as { __vmsPg?: postgres.Sql };

export const sqlClient =
  globalForDb.__vmsPg ??
  (globalForDb.__vmsPg = postgres(databaseUrl, {
    max: 10,
    prepare: true,
    idle_timeout: 20,
    connect_timeout: 10,
  }));

export const db = drizzle(sqlClient, { schema });

export { schema };
export type DB = typeof db;
