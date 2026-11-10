/**
 * scripts/dev-standalone — the zero-install development path.
 *
 *   npm run dev:standalone
 *
 *   1. Resolves embedded-Postgres ownership on ./.vms-data: this parent
 *      process almost always wins and becomes the single owner, serving
 *      the embedded postgres to every Next render worker over a localhost
 *      socket (@electric-sql/pglite-socket). If ANOTHER dev process already
 *      owns it, we attach instead of competing for the data dir.
 *   2. Runs the bootstrap (migrations + seed) through that same client if
 *      any migration file is still pending — fresh dirs get a full schema.
 *   3. Launches `next dev` with DATABASE_URL forced empty so lib/db/driver
 *      picks the embedded store — even when a local .env file configures a
 *      server URL (Next does not override env vars that are already set,
 *      so an explicit empty string wins over .env).
 *
 * To go back to a real Postgres just run `npm run dev` — DATABASE_URL in
 * .env then takes the postgres.js path unchanged.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createEmbeddedClient, VMS_DATA_DIR } from '../lib/db/pglite-factory';

const ROOT = join(__dirname, '..');
const NEXT_BIN = join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

async function main() {
  // Ownership-aware client: this process becomes the owner (serving the
  // socket Next workers attach to) or attaches to an already-running owner.
  const client = createEmbeddedClient(VMS_DATA_DIR);
  try {
    await client.waitReady;
  } catch (err) {
    console.error(
      `Embedded Postgres at ${VMS_DATA_DIR} failed to start:\n  ` +
        `${err instanceof Error ? err.message : err}\n` +
        `If the store is corrupt (e.g. a previous forced kill), run \`npm run db:reset\`.`,
    );
    process.exit(1);
  }

  if (client.mode === 'pglite') {
    console.log(
      `Embedded postgres owned by this process — serving 127.0.0.1:${client.servePort}`,
    );
  } else {
    console.log(
      `Attached to an already-running embedded postgres on 127.0.0.1:${client.servePort}`,
    );
  }

  const { bootstrap, pendingBootstrapFiles } = await import('./bootstrap');
  const pending = await pendingBootstrapFiles(client);
  if (pending > 0) {
    console.log(
      `Embedded database is missing ${pending === Infinity ? 'all' : pending} migration(s) — bootstrapping...`,
    );
    const result = await bootstrap(client);
    if (result.failed.length) {
      console.error('\nBootstrap incomplete — not starting dev server.');
      await client.close();
      process.exit(1);
    }
  } else {
    console.log(`Embedded database at ${VMS_DATA_DIR} is up to date.`);
  }

  console.log('\nStarting next dev on the embedded PGlite database...\n');
  const child = spawn(process.execPath, [NEXT_BIN, 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      // Explicitly empty (not undefined): @next/env treats an already-set
      // variable — even an empty one — as taking precedence over .env.
      DATABASE_URL: '',
    },
  });

  child.on('exit', (code, signal) => {
    void client.close().finally(() => {
      if (signal) process.kill(process.pid, signal);
      process.exit(code ?? 0);
    });
  });
}

main().catch((err) => {
  console.error('dev:standalone failed:', err);
  process.exit(1);
});
