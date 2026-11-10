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
