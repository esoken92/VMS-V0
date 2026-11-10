/**
 * lib/db — unified database client.
 *
 * Driver selection lives in ./driver.ts: postgres.js when DATABASE_URL is
 * set, embedded PGlite (./.vms-data) otherwise. Both expose the same
 * surface — `db` (drizzle) and `sqlClient`/`sql` (template tag) — so
 * existing imports keep working unchanged. The pool/client is a
 * per-process singleton shared across dev hot-reloads.
 */
export { db, sqlClient, sql, schema, dbDriver } from './driver';
export type { DB, DbDriver, Schema } from './driver';
