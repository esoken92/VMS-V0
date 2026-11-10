/**
 * scripts/seed.ts — seed dataset for local development.
 *
 *   npm run db:seed        (targets DATABASE_URL when set, else the
 *                           embedded PGlite store at ./.vms-data)
 *
 * What it does:
 *   1. Executes supabase/seed.sql (seed users' identity rows, bin locations,
 *      suppliers, products, stock movements, tool loans, stock takes) — but
 *      only on an empty dataset: parts of the file are not conflict-safe,
 *      so it is skipped entirely when seed data is already present.
 *   2. Sets profiles.password_hash to an argon2id hash for each seed user
 *      — plain SQL cannot produce argon2, so this happens here.
 *
 * `runSeed(executor)` is exported so scripts/bootstrap.ts can run the exact
 * same logic against the embedded PGlite instance it just migrated.
 *
 * SECURITY: these are well-known seed credentials. Never seed a
 * sensitive environment with them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import argon2 from 'argon2';
import { createExecutor, type SqlExecutor } from './db-executor';

const SEED_SQL = join(__dirname, '..', 'supabase', 'seed.sql');

const SEED_USERS: Array<{ email: string; password: string }> = [
  { email: 'admin@vms-v0.local', password: 'VmsAdmin123!' },
  { email: 'manager@vms-v0.local', password: 'VmsManager123!' },
  { email: 'fleet@vms-v0.local', password: 'VmsFleet123!' },
  { email: 'worker@vms-v0.local', password: 'VmsWorker123!' },
];

export async function runSeed(executor: SqlExecutor) {
  // Idempotency guard: seed.sql is NOT fully conflict-safe (the suppliers
  // insert has no ON CONFLICT, so a second run duplicates rows and the
  // products' (SELECT id FROM suppliers WHERE name=...) subqueries then
  // fail with "more than one row"). Skip the bulk file when seed data is
  // already present — the argon2 password-hash refresh below is itself
  // idempotent and always runs.
  const seeded = await executor
    .query<{ n: number | string }>('SELECT count(*) AS n FROM public.suppliers')
    .then((rows) => Number(rows[0]?.n ?? 0) > 0)
    .catch(() => false);

  if (seeded) {
    console.log('Seed dataset already present — skipping seed.sql (refreshing hashes only).');
  } else {
    console.log('Applying supabase/seed.sql ...');
    await executor.exec(readFileSync(SEED_SQL, 'utf8'));
  }

  console.log('Setting argon2id password hashes ...');
  for (const { email, password } of SEED_USERS) {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const updated = await executor.query<{ id: string }>(
      `UPDATE public.profiles p
       SET password_hash = $1
       FROM auth.users u
       WHERE u.email = $2 AND p.id = u.id
       RETURNING p.id`,
      [hash, email],
    );
    if (updated.length === 0) {
      console.warn(`  ! no profile found for ${email} — was seed.sql applied?`);
    } else {
      console.log(`  ok  ${email}`);
    }
  }

  console.log('Seed complete.');
}

async function main() {
  const { executor, kind } = await createExecutor();
  console.log(`Seed target: ${kind === 'pglite' ? 'embedded PGlite' : 'postgres.js (DATABASE_URL)'}`);
  try {
    await runSeed(executor);
  } finally {
    await executor.close();
  }
}

// Only run when invoked directly (`npm run db:seed` → tsx scripts/seed.ts),
// not when imported by scripts/bootstrap.ts.
if (process.argv[1] && /seed\.(ts|js|mjs|cjs)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
