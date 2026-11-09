import type { Config } from 'drizzle-kit';

// drizzle.config.ts — schema lives in ./drizzle/schema.ts.
// NOTE: the baseline schema is applied by docker-compose initdb from
// supabase/migrations/*.sql. Drizzle migrations in ./drizzle/ only carry
// deltas that came after the SQL baseline (e.g. profiles.password_hash).
export default {
  schema: './drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://vms:vms_local_dev@localhost:5432/vms',
  },
  // The `auth` schema is managed by 000_bootstrap.sql, not drizzle migrations.
  schemaFilter: ['public', 'auth'],
  strict: true,
  verbose: true,
} satisfies Config;
