/**
 * lib/db/pglite-factory — embedded PGlite lifecycle + cross-process ownership.
 *
 * WHY OWNERSHIP EXISTS (learned the hard way):
 *   `next dev` evaluates server modules in MULTIPLE node processes/contexts
 *   (router-server, app render worker, pages worker) — a `globalThis`
 *   singleton cannot deduplicate across them. PGlite's postgres also writes
 *   a FAKE pid (-42) into postmaster.pid, so Postgres' own lock-file check
 *   is blind and can't reliably stop a second open of the same data dir.
 *   Two live postgres backends on one dir write the same WAL and corrupt it
 *   (observed: PANIC "could not locate a valid checkpoint record").
 *
 * THE PROTOCOL:
 *   `<dataDir>/vms-owner.json` — written atomically (O_EXCL). Whoever claims
 *   it first owns the real PGlite instance and additionally serves it over
 *   a localhost TCP socket (@electric-sql/pglite-socket) on a random port.
 *   Every other context/process that wants the embedded DB reads the file,
 *   verifies the owner pid is alive, and attaches via a postgres.js client
 *   — the same driver as the real-Postgres path. Ownership reverts to
 *   whoever claims it next when the owner dies (pid check) or exits
 *   cleanly (file removed on close).
 *
 *   Result: any number of Next dev workers, scripts, or standalone
 *   processes converge on exactly ONE embedded postgres — with zero
 *   external services and no manual coordination.
 *
 * Extensions: uuid-ossp (uuid_generate_v4 — column defaults all over
 * supabase/migrations) and pgcrypto (crypt/gen_salt in the
 * create_user_with_profile RPC, gen_random_uuid in drizzle deltas). They
 * ship as contrib side-modules that must be registered at EVERY init.
 *
 * Windows/OneDrive robustness:
 *  - OneDrive applies the read-only attribute to synced files; inside an
 *    R-attributed .vms-data postgres cannot create postmaster.pid and init
 *    dies with "Permission denied". We strip the attribute recursively
 *    before opening (best-effort, win32 only). IMPORTANT: postmaster.pid
 *    is only ever removed AFTER winning ownership — deleting a live
 *    owner's pid file lets a second postgres think the dir is free and
 *    corrupt the WAL.
 *  - SIGINT/SIGTERM close the instance so the next start is clean.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/** Directory PGlite persists the database to (gitignored). */
export const VMS_DATA_DIR = resolve(
  process.env.VMS_DATA_DIR ?? join(process.cwd(), '.vms-data'),
);

/** Ownership/discovery file inside the data dir. */
const OWNER_FILENAME = 'vms-owner.json';
/** Time to wait for a starting owner to announce its socket port. */
const OWNER_START_GRACE_MS = 20_000;
/** Between polls of the owner file while it is coming up. */
const POLL_MS = 120;
/** postgres.js pool size for each remote (attached) client. */
const REMOTE_POOL_MAX = 4;
/** Socket server cap: several dev workers can attach at once. */
const SOCKET_MAX_CONNECTIONS = 32;

interface OwnerMeta {
  pid: number;
  /** 0 while the owner is still bringing its socket up. */
  port: number;
  startedAt: string;
}

/**
 * drizzle-orm/pglite's session passes `parsers` that return raw column text
 * for these OIDs (timestamp/timestamptz/interval/date + their array types +
 * numeric[]) so drizzle can apply its own mapFromDriverValue. postgres.js
 * would otherwise hand us Date objects / parsed arrays that drizzle then
 * mis-maps. Register the same passthroughs on every remote client so the
 * socket path sees IDENTICAL values to a local PGlite.query() call.
 */
const DRIZZLE_RAW_OIDS = [
  1082, // date
  1114, // timestamp
  1184, // timestamptz
  1186, // interval
  1231, // numeric[]
  1115, // timestamp[]
  1185, // timestamptz[]
  1187, // interval[]
  1182, // date[]
] as const;

const REMOTE_TYPES = {
  // Name is arbitrary; postgres.js keys parsers by OID in `from`.
  drizzleRawPassthrough: {
    to: 1184, // timestamptz — used only for explicit params of that type
    from: [...DRIZZLE_RAW_OIDS],
    serialize: (value: unknown) =>
      value instanceof Date ? value.toISOString() : String(value),
    parse: (raw: string) => raw,
  },
};

/** Result shape PGlite.query returns (subset we produce remotely too). */
interface PGliteResult {
  rows: unknown[];
  affectedRows?: number;
}

/** Row shape depends on the caller's QueryOptions — drizzle asks for
 *  'array' (positional rows) vs 'object'. postgres.js .values() gives the
 *  same positional arrays PGlite produces. */
async function runRemoteQuery(
  sql: postgres.Sql | postgres.ReservedSql,
  text: string,
  params: unknown[],
  options?: Record<string, unknown>,
): Promise<PGliteResult> {
  const pending = sql.unsafe(text, params as never[]);
  const res =
    options?.rowMode === 'array' ? await pending.values() : await pending;
  return { rows: Array.from(res), affectedRows: res.count };
}

// Process-wide registry of live embedded OWNER instances — prevents a
// second raw open of the same data dir inside this process (a second
// PGlite on one dir corrupts the WAL).
const globalForPglite = globalThis as unknown as {
  __vmsPgliteLive?: Set<string>;
};
const liveInstances = (globalForPglite.__vmsPgliteLive ??= new Set<string>());

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = exists but not ours; ESRCH = gone.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function ownerFilePath(dataDir: string): string {
  return join(dataDir, OWNER_FILENAME);
}

function readOwnerMeta(dataDir: string): OwnerMeta | null {
  try {
    const raw = readFileSync(ownerFilePath(dataDir), 'utf8');
    const meta = JSON.parse(raw) as Partial<OwnerMeta>;
    if (typeof meta.pid !== 'number' || typeof meta.port !== 'number') return null;
    return { pid: meta.pid, port: meta.port, startedAt: meta.startedAt ?? '' };
  } catch {
    return null;
  }
}

/** Atomically claim ownership. Returns true if THIS call won. */
function claimOwnership(dataDir: string): boolean {
  try {
    writeFileSync(
      ownerFilePath(dataDir),
      JSON.stringify({ pid: process.pid, port: 0, startedAt: new Date().toISOString() }),
      { flag: 'wx' },
    );
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  }
}

function announcePort(dataDir: string, port: number): void {
  writeFileSync(
    ownerFilePath(dataDir),
    JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }),
  );
}

/** Release the file only if WE own it (pid match). */
function releaseOwnership(dataDir: string): void {
  const meta = readOwnerMeta(dataDir);
  if (meta && meta.pid === process.pid) {
    try {
      rmSync(ownerFilePath(dataDir), { force: true });
    } catch {
      /* best-effort */
    }
  }
}

function prepareDataDir(dataDir: string): void {
  // Caller must hold the ownership claim — never touch files that could
  // belong to a live owner.
  if (!existsSync(dataDir)) return;

  if (process.platform === 'win32') {
    // Strip read-only attributes OneDrive applies to synced files.
    try {
      execSync(`attrib -r "${dataDir.replace(/[/\\]/g, '\\')}\\*.*" /s`, {
        stdio: 'ignore',
      });
    } catch {
      /* best-effort */
    }
  }

  // Stale lock files from an unclean exit — safe to remove ONLY under the
  // ownership claim (any previous owner is provably dead at this point).
  for (const lockFile of ['postmaster.pid', 'postmaster.opts']) {
    try {
      rmSync(join(dataDir, lockFile), { force: true });
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Open the underlying PGlite directly. Only valid after winning ownership
 * of dataDir — use createEmbeddedClient() instead of calling this.
 */
function openOwnedPGlite(dataDir: string): PGlite {
  if (liveInstances.has(dataDir)) {
    throw new Error(
      `A PGlite instance is already open on ${dataDir} in this process — ` +
        `reuse the shared embedded client instead of opening a second one.`,
    );
  }
  const pg = new PGlite(dataDir, {
    extensions: { uuid_ossp, pgcrypto },
  });
  liveInstances.add(dataDir);

  const originalClose = pg.close.bind(pg);
  pg.close = (async (...args: Parameters<PGlite['close']>) => {
    try {
      return await originalClose(...args);
    } finally {
      liveInstances.delete(dataDir);
    }
  }) as PGlite['close'];

  return pg;
}

/** Minimal transaction surface drizzle's PgliteSession drives: PGlite's own
 *  Transaction satisfies it (nested tx = savepoints) and RemoteTxClient
 *  reimplements it over a reserved postgres.js connection. */
export interface EmbeddedTxClient {
  query(
    text: string,
    params?: unknown[],
    options?: Record<string, unknown>,
  ): Promise<PGliteResult>;
  /** Multi-statement exec inside the transaction (migration scripts). */
  exec(text: string): Promise<unknown>;
  transaction<T>(cb: (tx: EmbeddedTxClient) => Promise<T>): Promise<T>;
}

/**
 * A PGlite-compatible client that either OWNS the embedded postgres on
 * dataDir (+ serves it over a localhost socket) or ATTACHES remotely to
 * whoever owns it. Exposes the subset of the PGlite surface that
 * drizzle-orm/pglite and the app's sql template tag need.
 */
export class EmbeddedPGliteClient {
  private readonly dataDir: string;
  private state: 'resolving' | 'owner' | 'remote' | 'broken' = 'resolving';
  private local: PGlite | null = null;
  private socketServer: PGLiteSocketServer | null = null;
  private remote: postgres.Sql | null = null;
  private resolveError: Error | null = null;
  private closed = false;
  private cleanupRegistered = false;
  private readyPromise: Promise<void>;

  constructor(dataDir: string = VMS_DATA_DIR) {
    this.dataDir = dataDir;
    this.readyPromise = this.resolve();
    // Suppress unhandledRejection noise — the same error is re-thrown at
    // every query() call site that actually needs the database.
    this.readyPromise.catch(() => undefined);
  }

  /** Resolves once the client knows where its queries go; rejects on a
   *  broken embedded store. Refreshed by reresolve() after owner death. */
  get waitReady(): Promise<void> {
    return this.readyPromise;
  }

  /** 'pglite' when this process owns the instance, 'pglite-remote' when it
   *  attached to another process's socket server. */
  get mode(): 'pglite' | 'pglite-remote' | 'pending' | 'broken' {
    if (this.state === 'owner') return 'pglite';
    if (this.state === 'remote') return 'pglite-remote';
    if (this.state === 'broken') return 'broken';
    return 'pending';
  }

  /** Port of the embedded socket server we serve or are attached to. */
  get servePort(): number | null {
    if (this.state === 'owner' && this.socketServer) {
      return Number(this.socketServer.getServerConn().split(':').pop());
    }
    const meta = readOwnerMeta(this.dataDir);
    return meta && meta.port ? meta.port : null;
  }

  // ---------------------------------------------------------------------
  // Ownership resolution
  // ---------------------------------------------------------------------

  private async resolve(): Promise<void> {
    const deadline = Date.now() + OWNER_START_GRACE_MS;
    let ownerAttempts = 0;
    // The owner file lives inside the data dir — make sure it exists.
    mkdirSync(this.dataDir, { recursive: true });

    while (Date.now() < deadline) {
      if (this.closed) throw new Error('embedded client closed during init');
      const meta = readOwnerMeta(this.dataDir);

      if (meta && !pidAlive(meta.pid)) {
        // Dead owner — reclaim.
        try {
          rmSync(ownerFilePath(this.dataDir), { force: true });
        } catch {
          /* another resolver may beat us to it */
        }
        continue;
      }

      if (meta && meta.port) {
        if (await this.attachRemote(meta.port)) {
          this.state = 'remote';
          return;
        }
        // Announced but not accepting (dying owner) — retry until it dies
        // and the file is reclaimed, or we claim it ourselves.
        await delay(POLL_MS);
        continue;
      }

      if (meta) {
        // Owner claimed but hasn't announced a port yet — it is starting.
        await delay(POLL_MS);
        continue;
      }

      // No live owner — try to claim.
      if (!claimOwnership(this.dataDir)) {
        await delay(POLL_MS);
        continue;
      }

      try {
        await this.becomeOwner();
        this.state = 'owner';
        this.registerCleanup();
        return;
      } catch (err) {
        // Lost the postgres open (rare: raced another starter that then
        // won, or genuinely corrupt store). Release the claim and retry
        // briefly — if the store is corrupt the retry will hit 'broken'
        // quickly because the file keeps failing.
        this.disposeLocal();
        releaseOwnership(this.dataDir);
        this.resolveError = err instanceof Error ? err : new Error(String(err));
        ownerAttempts++;
        if (ownerAttempts >= 3) {
          this.state = 'broken';
          return;
        }
        await delay(300);
      }
    }

    this.state = 'broken';
    this.resolveError ??= new Error(
      `Timed out waiting for the embedded Postgres owner on ${this.dataDir} ` +
        `to announce its socket (another process may be stuck starting).`,
    );
  }

  private async becomeOwner(): Promise<void> {
    prepareDataDir(this.dataDir);
    const pg = openOwnedPGlite(this.dataDir);
    this.local = pg;
    await pg.waitReady;

    const server = new PGLiteSocketServer({
      db: pg,
      port: 0,
      host: '127.0.0.1',
      maxConnections: SOCKET_MAX_CONNECTIONS,
    });
    await server.start();
    this.socketServer = server;

    const port = Number(server.getServerConn().split(':').pop());
    announcePort(this.dataDir, port);
  }

  private async attachRemote(port: number): Promise<boolean> {
    const sql = postgres(`postgres://postgres@127.0.0.1:${port}/postgres`, {
      max: REMOTE_POOL_MAX,
      connect_timeout: 5,
      idle_timeout: 20,
      // Embedded single-writer: prepared statements add nothing but wire
      // round-trips through the socket bridge.
      prepare: false,
      types: REMOTE_TYPES,
      // Embedded mode prints notices through the OWNER process (PGlite
      // surfaces them itself) — suppress per-attach duplicates.
      onnotice: () => undefined,
    });
    try {
      await sql`select 1`;
    } catch {
      await sql.end({ timeout: 1 }).catch(() => undefined);
      return false;
    }
    this.remote = sql;
    return true;
  }

  /** Remote broke (owner exited) — drop it and re-resolve once. */
  private async reresolve(): Promise<void> {
    if (this.state !== 'remote') return;
    const dead = this.remote;
    this.remote = null;
    this.state = 'resolving';
    if (dead) await dead.end({ timeout: 1 }).catch(() => undefined);
    this.readyPromise = this.resolve();
    await this.readyPromise;
  }

  private async route(): Promise<'owner' | 'remote'> {
    await this.readyPromise;
    if (this.state === 'owner' || this.state === 'remote') return this.state;
    throw (
      this.resolveError ??
      new Error(`Embedded Postgres at ${this.dataDir} is unavailable`)
    );
  }

  // ---------------------------------------------------------------------
  // PGlite-compatible surface
  // ---------------------------------------------------------------------

  async query(
    text: string,
    params: unknown[] = [],
    options?: Record<string, unknown>,
  ): Promise<PGliteResult> {
    const which = await this.route();
    if (which === 'owner' && this.local) {
      return (await this.local.query(text, params, options)) as PGliteResult;
    }
    if (which === 'remote' && this.remote) {
      try {
        return await runRemoteQuery(this.remote, text, params, options);
      } catch (err) {
        console.error(
          '[db] remote embedded query failed:',
          err instanceof Error ? err.message : err,
          '\n  sql>',
          text.slice(0, 160),
        );
        // Owner may have exited — re-resolve once, then retry once.
        await this.reresolve();
        const which2 = await this.route();
        if (which2 === 'remote' && this.remote) {
          return runRemoteQuery(this.remote, text, params, options);
        }
        if (which2 === 'owner' && this.local) {
          return (await this.local.query(text, params, options)) as PGliteResult;
        }
        throw err;
      }
    }
    throw new Error('embedded client unreachable');
  }

  /** Multi-statement exec (no params) — used by migration/seed scripts. */
  async exec(text: string): Promise<void> {
    const which = await this.route();
    if (which === 'owner' && this.local) {
      await this.local.exec(text);
      return;
    }
    if (this.remote) {
      await this.remote.unsafe(text);
      return;
    }
    throw new Error('embedded client unreachable');
  }

  /** drizzle calls client.transaction(cb) — cb receives a tx client with
   *  the same .query/.transaction surface (nested → savepoints). */
  async transaction<T>(
    cb: (tx: EmbeddedTxClient) => Promise<T>,
  ): Promise<T> {
    const which = await this.route();
    if (which === 'owner' && this.local) {
      // PGlite's Transaction already satisfies EmbeddedTxClient.
      return this.local.transaction(
        async (tx) => cb(tx as unknown as EmbeddedTxClient),
      );
    }
    if (this.remote) {
      const conn = await this.remote.reserve();
      const tx = new RemoteTxClient(conn);
      try {
        await conn.unsafe('BEGIN');
        const result = await cb(tx);
        await conn.unsafe('COMMIT');
        return result;
      } catch (err) {
        await conn.unsafe('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        conn.release();
      }
    }
    throw new Error('embedded client unreachable');
  }

  /** PGlite-compatible (sync). Only the owner can answer truthfully;
   *  remote attachers route queries over the socket and never own the tx. */
  isInTransaction(): boolean {
    if (this.state === 'owner' && this.local) {
      try {
        return this.local.isInTransaction();
      } catch {
        return false;
      }
    }
    return false;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.readyPromise.catch(() => undefined);
      if (this.socketServer) {
        await this.socketServer.stop().catch(() => undefined);
        this.socketServer = null;
      }
      if (this.local) {
        await this.local.close().catch(() => undefined);
        this.local = null;
      }
      if (this.remote) {
        await this.remote.end({ timeout: 2 }).catch(() => undefined);
        this.remote = null;
      }
    } finally {
      releaseOwnership(this.dataDir);
      this.state = 'broken';
    }
  }

  private disposeLocal(): void {
    if (this.local) {
      liveInstances.delete(this.dataDir);
      void this.local.close().catch(() => undefined);
      this.local = null;
    }
    if (this.socketServer) {
      void this.socketServer.stop().catch(() => undefined);
      this.socketServer = null;
    }
  }

  private registerCleanup(): void {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;
    let closePromise: Promise<unknown> | null = null;
    const close = () => {
      closePromise ??= this.close().catch(() => undefined);
      return closePromise;
    };
    const onSignal = (signal: NodeJS.Signals) => {
      void Promise.race([close(), delay(1500)]).then(() =>
        process.kill(process.pid, signal),
      );
    };
    process.once('SIGINT', () => onSignal('SIGINT'));
    process.once('SIGTERM', () => onSignal('SIGTERM'));
    process.once('beforeExit', () => {
      void close();
    });
  }
}

/** Transaction client over a reserved postgres.js connection (remote
 *  path). Nested transactions map to SAVEPOINTs. */
class RemoteTxClient implements EmbeddedTxClient {
  private savepointSeq = 0;
  constructor(private conn: postgres.ReservedSql) {}
  query(
    text: string,
    params: unknown[] = [],
    options?: Record<string, unknown>,
  ): Promise<PGliteResult> {
    return runRemoteQuery(this.conn, text, params, options);
  }
  async exec(text: string): Promise<unknown> {
    return this.conn.unsafe(text);
  }
  async transaction<T>(cb: (tx: EmbeddedTxClient) => Promise<T>): Promise<T> {
    const name = `vms_sp_${++this.savepointSeq}`;
    await this.conn.unsafe(`SAVEPOINT ${name}`);
    try {
      const result = await cb(this);
      await this.conn.unsafe(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (err) {
      await this.conn
        .unsafe(`ROLLBACK TO SAVEPOINT ${name}`)
        .catch(() => undefined);
      throw err;
    }
  }
}

/**
 * The single entry point for embedded-mode database access. Resolves
 * ownership asynchronously; every method awaits resolution before routing.
 * Multiple EmbeddedPGliteClient objects may exist across processes/contexts
 * — exactly one will own the dir, the rest attach over the socket.
 */
export function createEmbeddedClient(
  dataDir: string = VMS_DATA_DIR,
): EmbeddedPGliteClient {
  return new EmbeddedPGliteClient(dataDir);
}

/**
 * True when another process currently owns the embedded store. Used by
 * `db:reset` to refuse wiping .vms-data out from under a live dev server.
 */
export function isEmbeddedOwnerAlive(dataDir: string = VMS_DATA_DIR): boolean {
  const meta = readOwnerMeta(dataDir);
  return meta !== null && pidAlive(meta.pid);
}
