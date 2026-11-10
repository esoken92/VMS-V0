/**
 * scripts/bootstrap.ts — initialise the embedded PGlite database at
 * ./.vms-data so `npm run dev` works with ZERO external services.
 *
 *   npm run db:bootstrap
 *
 * Pipeline (mirrors scripts/migrate.ts ordering):
 *   1. Prelude   — uuid-ossp/pgcrypto contrib extensions (+ honest fallback
 *                  shims if a module ever fails to load) and the auth/
 *                  storage schema stubs 000_bootstrap.sql expects. These
 *                  run BEFORE any migration file.
 *   2. Baseline  — supabase/migrations/*.sql in filename order.
 *   3. Deltas    — drizzle/*.sql in filename order.
 *   4. Seed      — the exact runSeed() logic from scripts/seed.ts.
 *
 * Compatibility notes for PGlite (Postgres 18 on WASM):
 *   - Files are applied statement-by-statement through a scanner that
 *     understands $$ dollar-quoting, '--'/'* *' comments and quoted
 *     identifiers — PGlite's simple-protocol exec runs a whole multi-
 *     statement string in ONE implicit transaction, which would break
 *     `ALTER TYPE ... ADD VALUE` (006) and hide partial progress.
 *   - Each file runs inside pg.transaction() (all-or-nothing, like
 *     postgres transactional DDL) EXCEPT files containing statements that
 *     Postgres itself forbids inside a transaction (ALTER TYPE ADD VALUE,
 *     CREATE INDEX CONCURRENTLY, VACUUM/REINDEX) — those run non-
 *     transactionally with an explicit warning.
 *   - `CREATE EXTENSION` statements for uuid-ossp/pgcrypto inside the SQL
 *     files are handled by the prelude (the wasm side-modules must load at
 *     PGlite init, not at CREATE EXTENSION time) and are skipped here with
 *     a log line.
 *   - Applied filenames are recorded in public._migrations (same names as
 *     scripts/migrate.ts: sql/<file>, drizzle/<file>) so bootstrap is
 *     idempotent — re-running skips completed files, and a file only
 *     counts as applied when it finished cleanly.
 *
 * Nothing here is silently swallowed: every failure is logged with the
 * offending statement, security-critical objects get retried next run,
 * and the script exits non-zero if ANY statement failed.
 */
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  createEmbeddedClient,
  isEmbeddedOwnerAlive,
  VMS_DATA_DIR,
  type EmbeddedPGliteClient,
} from '../lib/db/pglite-factory';
import { wrapPGlite } from './db-executor';
import { runSeed } from './seed';

const BASELINE_DIR = join(__dirname, '..', 'supabase', 'migrations');
const DRIZZLE_DIR = join(__dirname, '..', 'drizzle');

/** Minimal client surface the migration pipeline needs — satisfied by both
 *  EmbeddedPGliteClient (owner or socket-attached) and a raw PGlite. */
interface MigrationClient {
  exec(text: string): Promise<unknown>;
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  transaction<T>(
    cb: (tx: { exec(text: string): Promise<unknown> }) => Promise<T>,
  ): Promise<T>;
}

/** Ordered migration set: supabase baseline first, then drizzle deltas. */
function expectedFiles(): Array<{ name: string; path: string }> {
  return [
    ...readdirSync(BASELINE_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => ({ name: `sql/${f}`, path: join(BASELINE_DIR, f) })),
    ...readdirSync(DRIZZLE_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => ({ name: `drizzle/${f}`, path: join(DRIZZLE_DIR, f) })),
  ];
}

// ---------------------------------------------------------------------------
// SQL splitting — PGlite exec() would otherwise run a whole file in one
// implicit transaction (simple query protocol semantics).
// ---------------------------------------------------------------------------

/** Split a .sql file into individual statements, respecting $$ bodies,
 *  '--'/'* *' comments and single/double-quoted strings & identifiers. */
export function splitSqlStatements(input: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const n = input.length;
  let dollarTag: string | null = null;

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];

    if (dollarTag) {
      if (input.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        current += ch;
        i++;
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      const eol = input.indexOf('\n', i);
      const end = eol === -1 ? n : eol;
      current += input.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = input.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      current += input.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === "'") {
      current += ch;
      i++;
      while (i < n) {
        const c = input[i];
        if (c === '\\') {
          current += input.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c === "'") {
          if (input[i + 1] === "'") {
            current += "''";
            i += 2;
            continue;
          }
          current += c;
          i++;
          break;
        }
        current += c;
        i++;
      }
      continue;
    }

    if (ch === '"') {
      current += ch;
      i++;
      while (i < n) {
        const c = input[i];
        if (c === '"') {
          if (input[i + 1] === '"') {
            current += '""';
            i += 2;
            continue;
          }
          current += c;
          i++;
          break;
        }
        current += c;
        i++;
      }
      continue;
    }

    if (ch === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(input.slice(i));
      if (m) {
        dollarTag = m[0];
        current += m[0];
        i += m[0].length;
        continue;
      }
      current += ch;
      i++;
      continue;
    }

    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

// ---------------------------------------------------------------------------
// Prelude
// ---------------------------------------------------------------------------

interface PreludeResult {
  notes: string[];
  failures: string[];
}

async function runPrelude(pg: MigrationClient): Promise<PreludeResult> {
  const notes: string[] = [];
  const failures: string[] = [];

  // Contrib extensions. The wasm side-modules are registered at PGlite
  // construction (lib/db/pglite-factory.ts), so CREATE EXTENSION only
  // installs the catalog objects. Fallbacks below keep the schema usable
  // if a module ever fails to load — loudly, never silently.
  try {
    await pg.exec('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    notes.push('extension uuid-ossp installed');
  } catch {
    await pg.exec(
      `CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
       RETURNS uuid LANGUAGE sql VOLATILE
       AS $$ SELECT gen_random_uuid() $$`,
    );
    notes.push(
      'uuid-ossp unavailable — installed uuid_generate_v4() shim over built-in gen_random_uuid()',
    );
  }

  try {
    await pg.exec('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    notes.push('extension pgcrypto installed');
  } catch {
    // crypt()/gen_salt() are only invoked by the create_user_with_profile
    // RPC — the app path manages users + argon2 hashes itself. Stubs raise
    // an honest error if anything ever calls them.
    await pg.exec(
      `CREATE OR REPLACE FUNCTION public.crypt(text, text)
       RETURNS text LANGUAGE plpgsql
       AS $$ BEGIN RAISE EXCEPTION 'pgcrypto is unavailable in embedded mode'; END $$;
       CREATE OR REPLACE FUNCTION public.gen_salt(text)
       RETURNS text LANGUAGE plpgsql
       AS $$ BEGIN RAISE EXCEPTION 'pgcrypto is unavailable in embedded mode'; END $$;`,
    );
    notes.push(
      'pgcrypto unavailable — installed crypt()/gen_salt() stubs that raise on call',
    );
  }

  // Schema prelude: auth/storage stubs must exist before the baseline runs.
  // Identical (and idempotent) to supabase/migrations/000_bootstrap.sql —
  // duplicated here so the contract "auth.users + auth.uid() exist before
  // migrations" holds even if that file is ever reordered or skipped.
  const prelude = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;
`;

  for (const stmt of splitSqlStatements(prelude)) {
    try {
      await pg.exec(stmt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`prelude: ${msg}\n    stmt> ${firstLine(stmt)}`);
    }
  }

  return { notes, failures };
}

// ---------------------------------------------------------------------------
// Migration files
// ---------------------------------------------------------------------------

/** Statements Postgres itself forbids inside a transaction block. */
const NON_TRANSACTIONAL =
  /ALTER\s+TYPE[\s\S]*?ADD\s+VALUE|CREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY|\bVACUUM\b|\bREINDEX\b/i;

/** Extension statements the prelude owns (wasm side-modules load at init). */
const PRELUDE_EXTENSION = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?(uuid-ossp|pgcrypto)"?/i;

interface FileOutcome {
  name: string;
  status: 'applied' | 'skipped' | 'failed';
  statements: number;
  error?: string;
}

function firstLine(s: string): string {
  const line = s.split('\n').find((l) => l.trim().length > 0) ?? '';
  return line.trim().slice(0, 140);
}

async function applyFile(
  pg: MigrationClient,
  name: string,
  body: string,
): Promise<FileOutcome> {
  const statements = splitSqlStatements(body).filter((stmt) => {
    if (PRELUDE_EXTENSION.test(stmt)) {
      console.log(`    (extension handled by prelude: ${firstLine(stmt)})`);
      return false;
    }
    return true;
  });

  const runAll = async (exec: (s: string) => Promise<unknown>) => {
    for (const stmt of statements) {
      try {
        await exec(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`${msg}\n    stmt> ${firstLine(stmt)}`);
      }
    }
    await exec(`INSERT INTO public._migrations (name) VALUES ('${name}')`);
  };

  if (NON_TRANSACTIONAL.test(body)) {
    // Not wrappable (e.g. ALTER TYPE ... ADD VALUE in 006). Apply
    // statement-by-statement; a mid-file failure leaves partial state and
    // is NOT recorded, so the next run retries the whole file. To keep
    // re-runs viable, "already exists" errors are logged and skipped —
    // anything else still fails the file loudly.
    console.log('    (contains transaction-forbidden statements — applying without tx)');
    try {
      for (const stmt of statements) {
        try {
          await pg.exec(stmt);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/already exists|duplicate/i.test(msg)) {
            console.log(`    already applied — skipping (${firstLine(stmt)})`);
            continue;
          }
          throw new Error(`${msg}\n    stmt> ${firstLine(stmt)}`);
        }
      }
      await pg.exec(`INSERT INTO public._migrations (name) VALUES ('${name}')`);
    } catch (err) {
      return {
        name,
        status: 'failed',
        statements: statements.length,
        error: `${err instanceof Error ? err.message : String(err)}\n    NOTE: file ran WITHOUT a transaction — partial application possible; fix the error and re-run.`,
      };
    }
    return { name, status: 'applied', statements: statements.length };
  }

  try {
    await pg.transaction(async (tx) => {
      await runAll((s) => tx.exec(s));
    });
  } catch (err) {
    return {
      name,
      status: 'failed',
      statements: statements.length,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return { name, status: 'applied', statements: statements.length };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export interface BootstrapResult {
  applied: string[];
  skipped: string[];
  failed: FileOutcome[];
  seeded: boolean;
}

/**
 * Number of migration files not yet recorded in public._migrations.
 * Returns Infinity when the table doesn't exist at all (fresh store).
 */
export async function pendingBootstrapFiles(
  pg: EmbeddedPGliteClient,
): Promise<number> {
  try {
    const rows = (await pg.query('SELECT name FROM public._migrations')).rows as Array<{
      name: string;
    }>;
    const applied = new Set(rows.map((r) => r.name));
    return expectedFiles().filter((f) => !applied.has(f.name)).length;
  } catch {
    return Infinity;
  }
}

/**
 * Run the full embedded bootstrap. When `existing` is provided the caller
 * owns the client lifecycle (dev-standalone reuses its socket-owning
 * client); otherwise this creates + closes its own embedded client.
 */
export async function bootstrap(
  existing?: EmbeddedPGliteClient,
): Promise<BootstrapResult> {
  console.log(`Embedded PGlite data dir: ${VMS_DATA_DIR}`);
  if (process.env.DATABASE_URL) {
    console.log(
      '  (DATABASE_URL is set — bootstrap still targets the embedded store.\n' +
        '   For a server Postgres use `npm run db:migrate` + `npm run db:seed`.)',
    );
  }

  const ownsClient = !existing;
  const pg = existing ?? createEmbeddedClient(VMS_DATA_DIR);
  await pg.waitReady;
  console.log(
    pg.mode === 'pglite'
      ? '  (owns the embedded postgres — applying directly)'
      : '  (attached to a running embedded postgres — applying via socket)',
  );

  const result: BootstrapResult = { applied: [], skipped: [], failed: [], seeded: false };

  try {
    const prelude = await runPrelude(pg);
    for (const note of prelude.notes) console.log(`  prelude: ${note}`);
    for (const f of prelude.failures) console.error(`  ✗ ${f}`);
    if (prelude.failures.length) {
      result.failed.push({
        name: 'prelude',
        status: 'failed',
        statements: 0,
        error: prelude.failures.join('\n'),
      });
      console.error('Prelude failed — aborting before migrations.');
      return result;
    }

    await pg.exec(
      `CREATE TABLE IF NOT EXISTS public._migrations (
         name TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    const applied = new Set(
      (await pg.query('SELECT name FROM public._migrations')).rows.map(
        (r) => (r as { name: string }).name,
      ),
    );

    const files = expectedFiles();

    for (const { name, path } of files) {
      if (applied.has(name)) {
        console.log(`  skip  ${name} (already applied)`);
        result.skipped.push(name);
        continue;
      }
      console.log(`  apply ${name} ...`);
      const outcome = await applyFile(pg, name, readFileSync(path, 'utf8'));
      if (outcome.status === 'applied') {
        console.log(`    ok (${outcome.statements} statements)`);
        result.applied.push(name);
      } else {
        console.error(`  ✗ ${name} FAILED:`);
        for (const line of (outcome.error ?? '').split('\n')) {
          console.error(`      ${line}`);
        }
        result.failed.push(outcome);
      }
    }

    if (result.failed.length === 0) {
      await runSeed(wrapPGlite(pg));
      result.seeded = true;

      const tables = await pg.query(
        `SELECT count(*)::int AS n FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );
      const users = await pg.query(
        `SELECT u.email, p.role, (p.password_hash IS NOT NULL) AS has_password
         FROM auth.users u JOIN public.profiles p ON p.user_id = u.id
         ORDER BY u.email`,
      );
      console.log('\nBootstrap verification:');
      console.log(`  public tables: ${(tables.rows[0] as { n: number }).n}`);
      for (const row of users.rows as Array<Record<string, unknown>>) {
        console.log(`  user ${row.email} (${row.role}) password_hash=${row.has_password}`);
      }
    }
  } finally {
    if (ownsClient) await pg.close();
  }

  if (result.failed.length) {
    console.error(
      `\nBootstrap finished with ${result.failed.length} failed file(s) — see above.\n` +
        'Security-critical objects (tables, triggers, functions) were NOT\n' +
        'skipped silently: fix the reported statements and re-run.',
    );
  } else {
    console.log('\nBootstrap complete. Sign in with admin@vms-v0.local / VmsAdmin123!');
  }
  return result;
}

async function resetDataDir(): Promise<void> {
  if (isEmbeddedOwnerAlive(VMS_DATA_DIR)) {
    throw new Error(
      'Another process currently owns .vms-data (a dev server is likely ' +
        'running). Stop it first — wiping a live postgres data dir ' +
        'corrupts the WAL.',
    );
  }
  rmSync(VMS_DATA_DIR, { recursive: true, force: true });
  console.log(`Removed ${VMS_DATA_DIR}`);
}

if (process.argv[1] && /bootstrap\.(ts|js|mjs|cjs)$/.test(process.argv[1])) {
  const reset = process.argv.slice(2).includes('--reset');
  (reset ? resetDataDir() : Promise.resolve())
    .then(() => bootstrap())
    .then((r) => {
      if (r.failed.length) process.exit(1);
    })
    .catch((err) => {
      console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
