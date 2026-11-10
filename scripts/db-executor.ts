/**
 * scripts/db-executor — minimal SQL executor shared by the seed and
 * bootstrap scripts so the same logic runs against either driver:
 *
 *   DATABASE_URL set    → postgres.js (matches scripts/migrate.ts)
 *   DATABASE_URL unset  → embedded PGlite at ./.vms-data
 *
 * Deliberately NOT the postgres.js `Sql` surface — just the two shapes the
 * scripts need: multi-statement exec (no params) and parameterized query.
 */
import postgres from 'postgres';
import { createEmbeddedClient, VMS_DATA_DIR } from '../lib/db/pglite-factory';

export interface SqlExecutor {
  /** Run a (possibly multi-statement) SQL string with no parameters. */
  exec(sqlText: string): Promise<void>;
  /** Parameterized query ($1..$n placeholders) returning rows. */
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export type ExecutorKind = 'postgres-js' | 'pglite';

export interface ExecutorHandle {
  executor: SqlExecutor;
  kind: ExecutorKind;
}

/** Wrap an existing PGlite-shaped client in the executor interface —
 *  works for both a raw PGlite and the ownership-aware embedded client. */
export function wrapPGlite(pg: {
  exec(text: string): Promise<unknown>;
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  close(): Promise<unknown>;
}): SqlExecutor {
  return {
    exec: (text) => pg.exec(text).then(() => undefined),
    query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
      (await pg.query(text, params ?? [])).rows as T[],
    close: () => pg.close().then(() => undefined),
  };
}

/**
 * `forceEmbedded` skips DATABASE_URL entirely (used by db:bootstrap, which
 * always targets the embedded store even if a server URL is configured).
 */
export async function createExecutor(opts?: {
  forceEmbedded?: boolean;
}): Promise<ExecutorHandle> {
  const url = process.env.DATABASE_URL;

  if (url && !opts?.forceEmbedded) {
    const sql = postgres(url, { max: 1 });
    return {
      kind: 'postgres-js',
      executor: {
        exec: (text) => sql.unsafe(text).then(() => undefined),
        query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
          (await sql.unsafe(text, (params ?? []) as never[])) as unknown as T[],
        close: () => sql.end(),
      },
    };
  }

  // Ownership-aware: if a dev server already owns .vms-data this attaches
  // to its localhost socket instead of opening a second postgres backend.
  const pg = createEmbeddedClient(VMS_DATA_DIR);
  await pg.waitReady;
  return { kind: 'pglite', executor: wrapPGlite(pg) };
}
