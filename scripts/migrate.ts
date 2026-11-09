/**
 * scripts/migrate.ts — apply supabase/migrations/*.sql (baseline), then
 * drizzle/*.sql (typed-schema deltas), in order.
 *
 * For Docker deployments these files are applied automatically by
 * postgres:16's /docker-entrypoint-initdb.d. This script exists for
 * non-Docker Postgres installs (and to re-apply on a fresh schema).
 *
 * Idempotent: applied filenames are recorded in public._migrations.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const BASELINE_DIR = join(__dirname, '..', 'supabase', 'migrations');
const DRIZZLE_DIR = join(__dirname, '..', 'drizzle');

const url =
  process.env.DATABASE_URL ??
  'postgresql://vms:vms_local_dev@localhost:5432/vms';

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public._migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const applied = new Set(
      (await sql`SELECT name FROM public._migrations`).map((r) => r.name),
    );

    // SQL baseline first, then drizzle deltas (tracked with a distinct prefix).
    const files: Array<{ name: string; path: string }> = [
      ...readdirSync(BASELINE_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => ({ name: `sql/${f}`, path: join(BASELINE_DIR, f) })),
      ...readdirSync(DRIZZLE_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => ({ name: `drizzle/${f}`, path: join(DRIZZLE_DIR, f) })),
    ];

    for (const { name, path } of files) {
      if (applied.has(name)) {
        console.log(`  skip  ${name} (already applied)`);
        continue;
      }
      const body = readFileSync(path, 'utf8');
      console.log(`  apply ${name} ...`);
      // Postgres supports transactional DDL — all-or-nothing per file.
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO public._migrations (name) VALUES (${name})`;
      });
    }

    console.log('Done.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
