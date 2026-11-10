/**
 * scripts/verify-ledger.ts — the golden ledger reconciliation check.
 *
 *   npx tsx scripts/verify-ledger.ts
 *
 * READ-ONLY: seeds nothing, writes nothing. Targets DATABASE_URL when set,
 * else the embedded PGlite store at ./.vms-data — the same connection
 * resolution as scripts/seed.ts (see ./db-executor).
 *
 * For every product it asserts the ledger identity
 *
 *   opening (0 at the epoch) + Σ stock_movements.quantity
 *     == products.current_stock
 *
 * — the same math as GET /api/v1/reconciliation and lib/actions/kardex.ts.
 * Prints a table of products with drift != 0 and exits non-zero, so it can
 * gate CI: any stock write that bypasses stock_movements (or a movement
 * that fails to update current_stock) fails this check.
 */
import { createExecutor } from './db-executor';

interface LedgerRow {
  sku: string;
  name: string;
  movements_total: number | string;
  actual_stock: number | string;
}

/** Round to the numeric(15,4) columns' precision — kills float noise. */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

async function main(): Promise<number> {
  const { executor, kind } = await createExecutor();
  console.log(
    `Verify target: ${kind === 'pglite' ? 'embedded PGlite' : 'postgres.js (DATABASE_URL)'}`,
  );
  try {
    const rows = await executor.query<LedgerRow>(`
      SELECT p.sku,
             p.name,
             COALESCE(SUM(m.quantity), 0)::float8 AS movements_total,
             p.current_stock::float8              AS actual_stock
      FROM public.products p
      LEFT JOIN public.stock_movements m ON m.product_id = p.id
      GROUP BY p.id, p.sku, p.name, p.current_stock
      ORDER BY p.sku
    `);

    const checked = rows.map((r) => {
      const expected = r4(Number(r.movements_total));
      const actual = r4(Number(r.actual_stock));
      return {
        sku: r.sku,
        name: r.name,
        expected_closing: expected,
        actual_stock: actual,
        drift: r4(actual - expected),
      };
    });

    const drifted = checked.filter((r) => r.drift !== 0);

    console.log(
      `Checked ${checked.length} product(s): ` +
        `${checked.length - drifted.length} reconcile, ${drifted.length} with drift.`,
    );

    if (drifted.length > 0) {
      console.table(drifted);
      console.error(
        'LEDGER DRIFT DETECTED — actual stock is not explained by stock_movements.',
      );
      return 1;
    }

    console.log('OK — every product reconciles: opening + movements = current stock.');

    // Second invariant (014 migration): the per-bin projection must agree —
    // Σ product_stock.quantity per product == current_stock, and no bin may
    // hold negative stock. Skipped when the table doesn't exist yet.
    const hasProjection = await executor.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_stock'
      ) AS exists
    `);
    if (hasProjection[0]?.exists) {
      // Products with a home bin must have ALL stock located; products
      // without one are legitimately unlocated (no product_stock rows).
      const binRows = await executor.query<LedgerRow>(`
        SELECT p.sku,
               p.name,
               COALESCE(SUM(s.quantity), 0)::float8 AS movements_total,
               p.current_stock::float8              AS actual_stock
        FROM public.products p
        LEFT JOIN public.product_stock s ON s.product_id = p.id
        WHERE p.bin_location_id IS NOT NULL
        GROUP BY p.id, p.sku, p.name, p.current_stock
        ORDER BY p.sku
      `);
      const unlocated = await executor.query<{ sku: string }>(`
        SELECT p.sku FROM public.product_stock s
        JOIN public.products p ON p.id = s.product_id
        WHERE p.bin_location_id IS NULL AND s.quantity <> 0
      `);
      const binDrift = binRows
        .map((r) => ({
          sku: r.sku,
          name: r.name,
          bin_total: r4(Number(r.movements_total)),
          actual_stock: r4(Number(r.actual_stock)),
          drift: r4(Number(r.actual_stock) - Number(r.movements_total)),
        }))
        .filter((r) => r.drift !== 0);
      const negative = await executor.query<{ sku: string; bin: string; quantity: number }>(`
        SELECT p.sku, s.bin_location_id::text AS bin, s.quantity::float8 AS quantity
        FROM public.product_stock s JOIN public.products p ON p.id = s.product_id
        WHERE s.quantity < 0
      `);
      if (binDrift.length > 0 || negative.length > 0 || unlocated.length > 0) {
        if (binDrift.length > 0) console.table(binDrift);
        if (negative.length > 0) console.table(negative);
        if (unlocated.length > 0) console.table(unlocated);
        console.error('BIN-LEVEL DRIFT DETECTED — product_stock disagrees with the ledger.');
        return 1;
      }
      console.log(`OK — per-bin projection reconciles (${binRows.length} located products), no negative bins.`);
    }

    return 0;
  } finally {
    await executor.close();
  }
}

// Only run when invoked directly (`npx tsx scripts/verify-ledger.ts`), not
// when imported — same guard as scripts/seed.ts.
if (process.argv[1] && /verify-ledger\.(ts|js|mjs|cjs)$/.test(process.argv[1])) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('verify-ledger failed:', err);
      process.exit(1);
    });
}
