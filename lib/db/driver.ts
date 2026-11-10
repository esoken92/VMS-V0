/**
 * lib/db/driver — database driver selection.
 *
 *   DATABASE_URL set    → postgres.js pool against a real Postgres server
 *                         (unchanged production/Docker path).
 *   DATABASE_URL unset  → embedded Postgres via PGlite (Postgres compiled
 *                         to WASM) persisting to ./.vms-data — zero external
 *                         services, zero Docker. See scripts/bootstrap.ts.
 *
 * Embedded mode is multi-process safe: `next dev` evaluates server modules
 * in several worker processes/contexts, so the first context to resolve
 * claims the data dir via an atomic owner file and serves it over a
 * localhost socket (@electric-sql/pglite-socket); every other context —
 * in this or other processes — attaches through postgres.js to that
 * socket. See lib/db/pglite-factory.ts for the ownership protocol.
 *
 * Unified surface (what the rest of the app imports):
 *   db        — drizzle query client. TYPED as PostgresJsDatabase
 *               (postgres.js is the authoritative type). Under PGlite the
 *               runtime object is a PgliteDatabase — the two drivers share
 *               the same PgDatabase surface (select/insert/update/delete/
 *               transaction/execute/relational query) and the same dialect,
 *               so the cast is honest *in practice*; the difference that
 *               matters is noted below.
 *   sqlClient — template-tag SQL client (`sqlClient`SELECT 1``), the same
 *               shape as postgres.js' Sql. Only that call signature is
 *               implemented for the embedded driver (the app uses it only
 *               in app/api/v1/health). `sql` is an alias.
 *   dbDriver  — which driver is active ('postgres-js' | 'pglite').
 *
 * Embedded-mode honest degradations vs real Postgres:
 *   - Single backend: all queries — local or socket-attached — serialize
 *     through one postgres process. db.transaction() serializes on it.
 *   - `db` is cast PgliteDatabase→PostgresJsDatabase — $client differs
 *     (EmbeddedPGliteClient, not postgres.Sql) if ever touched.
 *   - numeric→string, timestamptz→Date, uuid→string all match postgres.js
 *     behavior (verified); no app-facing type drift expected.
 *
 * Schema merge: drizzle/scan-schema.ts, drizzle/storerooms-schema.ts and
 * drizzle/api-schema.ts ship as separate delta files (their own migration
 * streams); drizzle's schema registry only reads Table/Relations values,
 * so spreading the whole namespaces is safe — constants and type exports
 * are ignored. binLocationRooms is an intentional shadow def of
 * bin_locations (exposes room_id); both keys resolve to the same table.
 */
import { drizzle as drizzlePostgresJs, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { createEmbeddedClient, VMS_DATA_DIR } from './pglite-factory';

import * as baseSchema from '@/drizzle/schema';
import * as scanSchema from '@/drizzle/scan-schema';
import * as storeroomsSchema from '@/drizzle/storerooms-schema';
import * as apiSchema from '@/drizzle/api-schema';

export const schema = {
  ...baseSchema,
  ...scanSchema,
  ...storeroomsSchema,
  ...apiSchema,
};

export type Schema = typeof schema;
export type DB = PostgresJsDatabase<Schema>;

export type DbDriver = 'postgres-js' | 'pglite';

interface DriverBundle {
  sqlClient: postgres.Sql;
  db: DB;
  dbDriver: DbDriver;
}

// Global singleton so Next dev hot-reloads don't exhaust connections or
// open a second PGlite over the same data directory.
const globalForDb = globalThis as unknown as { __vmsDb?: DriverBundle };

function createDriverBundle(): DriverBundle {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const client = postgres(databaseUrl, {
      max: 10,
      prepare: true,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return {
      sqlClient: client,
      db: drizzlePostgresJs(client, { schema }),
      dbDriver: 'postgres-js',
    };
  }

  // ---- Embedded PGlite path ---------------------------------------------
  // The @electric-sql/* imports evaluate only JS — the WASM engine (~3 MB)
  // initialises inside the embedded client below, which only runs when
  // DATABASE_URL is unset. The packages are declared external in
  // next.config.js (serverComponentsExternalPackages) so they resolve from
  // node_modules at runtime rather than being bundled.
  const client = createEmbeddedClient(VMS_DATA_DIR);

  // postgres.js Sql is a template-tag function returning a RowList promise.
  // This shim implements the same call signature over the embedded client's
  // query API; it returns a plain rows array (all the app needs). It
  // deliberately does NOT emulate the rest of the postgres.js surface
  // (.unsafe, .begin, etc. — scripts use scripts/db-executor.ts instead).
  const templateTag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce(
      (acc, part, i) => (i === 0 ? part : `${acc}$${i}${part}`),
      '',
    );
    return client.query(text, values).then((r) => r.rows);
  };

  // Ownership resolves asynchronously (first context wins, the rest attach
  // over the socket) — log which side this process/context ended up on.
  void client.waitReady
    .then(() => {
      const mode =
        client.mode === 'pglite'
          ? `owner — serving 127.0.0.1:${client.servePort}`
          : `attached to 127.0.0.1:${client.servePort}`;
      console.info(`[db] embedded PGlite at ${VMS_DATA_DIR} (${mode})`);
    })
    .catch((err) => {
      console.error(
        `[db] embedded PGlite at ${VMS_DATA_DIR} failed to initialise: ` +
          `${err instanceof Error ? err.message : err}. ` +
          `If .vms-data is corrupt, run \`npm run db:reset\`.`,
      );
    });

  return {
    // Honest cast: same PgDatabase API surface at runtime (see header).
    sqlClient: templateTag as unknown as postgres.Sql,
    db: drizzlePglite(client as unknown as PGlite, {
      schema,
      logger: process.env.VMS_DB_DEBUG === '1',
    }) as unknown as DB,
    dbDriver: 'pglite',
  };
}

const bundle = (globalForDb.__vmsDb ??= createDriverBundle());

export const db = bundle.db;
export const sqlClient = bundle.sqlClient;
/** Alias of sqlClient — the postgres.js-style template tag. */
export const sql = bundle.sqlClient;
export const dbDriver = bundle.dbDriver;
