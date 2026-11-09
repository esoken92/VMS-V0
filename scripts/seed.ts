/**
 * scripts/seed.ts — demo dataset for local development.
 *
 *   npm run db:seed
 *
 * What it does:
 *   1. Executes supabase/seed.sql (demo users' identity rows, bin locations,
 *      suppliers, products, stock movements, tool loans, stock takes).
 *      The file is fully idempotent (ON CONFLICT DO NOTHING / DO UPDATE).
 *   2. Sets profiles.password_hash to an argon2id hash for each demo user
 *      — plain SQL cannot produce argon2, so this happens here.
 *
 * SECURITY: these are well-known demo credentials. Never seed a
 * sensitive environment with them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import argon2 from 'argon2';
import postgres from 'postgres';

const SEED_SQL = join(__dirname, '..', 'supabase', 'seed.sql');

const DEMO_USERS: Array<{ email: string; password: string }> = [
  { email: 'demo.admin@vms-demo.com', password: 'DemoAdmin123!' },
  { email: 'demo.manager@vms-demo.com', password: 'DemoManager123!' },
  { email: 'demo.fleet@vms-demo.com', password: 'DemoFleet123!' },
  { email: 'demo.worker@vms-demo.com', password: 'DemoWorker123!' },
];

const url =
  process.env.DATABASE_URL ??
  'postgresql://vms:vms_local_dev@localhost:5432/vms';

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    console.log('Applying supabase/seed.sql ...');
    await sql.unsafe(readFileSync(SEED_SQL, 'utf8'));

    console.log('Setting argon2id password hashes ...');
    for (const { email, password } of DEMO_USERS) {
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      const updated = await sql`
        UPDATE public.profiles p
        SET password_hash = ${hash}
        FROM auth.users u
        WHERE u.email = ${email} AND p.id = u.id
        RETURNING p.id
      `;
      if (updated.count === 0) {
        console.warn(`  ! no profile found for ${email} — was seed.sql applied?`);
      } else {
        console.log(`  ok  ${email}`);
      }
    }

    console.log('Seed complete.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
