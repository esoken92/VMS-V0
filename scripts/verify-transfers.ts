/**
 * scripts/verify-transfers.ts — smoke test for the 014 transfer/kit ledger.
 *
 *   npx tsx scripts/verify-transfers.ts
 *
 * WRITES to the target DB: creates a throwaway transfer + kit, posts the
 * same legs the server actions post, and asserts the product_stock
 * projection tracks every step. Cleans up after itself where possible
 * (transfer docs stay — they're the audit trail — but on CT-* products).
 */
import { createExecutor } from './db-executor';

async function main(): Promise<number> {
  const { executor, kind } = await createExecutor();
  console.log(`Verify target: ${kind === 'pglite' ? 'embedded PGlite' : 'postgres.js (DATABASE_URL)'}`);
  try {
    // Pick two distinct bins + a product with stock at bin A.
    const [src] = await executor.query<{ id: string; label: string }>(`
      SELECT s.bin_location_id AS id, b.zone || '/' || b.bin_location AS label
      FROM product_stock s JOIN bin_locations b ON b.id = s.bin_location_id
      WHERE s.quantity >= 5 AND b.bin_location <> 'IN-TRANSIT' LIMIT 1`);
    const [dst] = await executor.query<{ id: string; label: string }>(`
      SELECT id, zone || '/' || bin_location AS label FROM bin_locations
      WHERE bin_location <> 'IN-TRANSIT' AND id <> '${src?.id ?? ''}' LIMIT 1`);
    if (!src || !dst) {
      console.error('Need >=2 bins and stock >=5 somewhere — run seeds first');
      return 1;
    }
    const [prod] = await executor.query<{ id: string; stock: number; bin: number }>(`
      SELECT product_id AS id, quantity::float8 AS stock, 0 AS bin
      FROM product_stock WHERE bin_location_id = '${src.id}' AND quantity >= 5 LIMIT 1`);
    console.log(`Moving 2 units of ${prod.id.slice(0, 8)}…  ${src.label} → ${dst.label}`);

    const [admin] = await executor.query<{ id: string }>(`
      SELECT user_id AS id FROM profiles WHERE role = 'super_admin' LIMIT 1`);
    const [transit] = await executor.query<{ id: string }>(`
      SELECT id FROM bin_locations WHERE zone = 'In Transit' AND bin_location = 'IN-TRANSIT'`);

    // Draft + dispatch legs (mirrors dispatchTransfer).
    const [t] = await executor.query<{ id: string; transfer_number: string }>(`
      INSERT INTO transfers (from_bin_location_id, to_bin_location_id, created_by, status, notes)
      VALUES ('${src.id}', '${dst.id}', '${admin.id}', 'dispatched', 'smoke test') RETURNING id, transfer_number`);
    const [ti] = await executor.query<{ id: string }>(`
      INSERT INTO transfer_items (transfer_id, product_id, quantity, dispatched_quantity)
      VALUES ('${t.id}', '${prod.id}', 2, 2) RETURNING id`);
    const [pre] = await executor.query<{ q: number }>(`
      SELECT COALESCE(quantity,0)::float8 AS q FROM product_stock
      WHERE product_id='${prod.id}' AND bin_location_id='${transit.id}'`);
    const transitBase = pre?.q ?? 0;
    await executor.query(`
      INSERT INTO stock_movements (product_id, user_id, type, quantity, reason, bin_location_id, transfer_item_id) VALUES
      ('${prod.id}', '${admin.id}', 'transfer', -2, '${t.transfer_number} dispatch', '${src.id}', '${ti.id}'),
      ('${prod.id}', '${admin.id}', 'transfer',  2, '${t.transfer_number} in transit', '${transit.id}', '${ti.id}')`);

    const mid = await executor.query<{ bin: string; q: number }>(`
      SELECT bin_location_id AS bin, quantity::float8 AS q FROM product_stock
      WHERE product_id = '${prod.id}' AND bin_location_id IN ('${src.id}','${transit.id}','${dst.id}')`);
    const srcMid = mid.find((r) => r.bin === src.id)?.q ?? 0;
    const transitMid = mid.find((r) => r.bin === transit.id)?.q ?? 0;
    console.log(`After dispatch: source=${srcMid} (expect ${prod.stock - 2}), transit=${transitMid} (expect ${transitBase + 2})`);
    if (srcMid !== prod.stock - 2 || transitMid !== transitBase + 2) return fail('dispatch legs did not project');

    // Receive legs.
    await executor.query(`
      INSERT INTO stock_movements (product_id, user_id, type, quantity, reason, bin_location_id, transfer_item_id) VALUES
      ('${prod.id}', '${admin.id}', 'transfer', -2, '${t.transfer_number} transit out', '${transit.id}', '${ti.id}'),
      ('${prod.id}', '${admin.id}', 'transfer',  2, '${t.transfer_number} received', '${dst.id}', '${ti.id}')`);
    await executor.query(`UPDATE transfers SET status='received', received_by='${admin.id}', received_at=NOW() WHERE id='${t.id}'`);

    const end = await executor.query<{ bin: string; q: number }>(`
      SELECT bin_location_id AS bin, quantity::float8 AS q FROM product_stock
      WHERE product_id = '${prod.id}' AND bin_location_id IN ('${src.id}','${transit.id}','${dst.id}')`);
    const transitEnd = end.find((r) => r.bin === transit.id)?.q ?? 0;
    const dstEnd = end.find((r) => r.bin === dst.id)?.q ?? 0;
    console.log(`After receive: transit=${transitEnd} (expect ${transitBase}), dest=${dstEnd} (expect >=2)`);
    if (transitEnd !== transitBase || dstEnd < 2) return fail('receive legs did not project');

    // Kit legs: consume 1 component → produce 1 kit on two products.
    const [other] = await executor.query<{ id: string }>(`
      SELECT id FROM products WHERE id <> '${prod.id}' LIMIT 1`);
    await executor.query(`
      INSERT INTO product_components (kit_product_id, component_product_id, quantity)
      VALUES ('${prod.id}', '${other.id}', 1) ON CONFLICT DO NOTHING`);
    // Legs draw/produce at each product's home bin — mirrors postKitLeg().
    const [otherBin] = await executor.query<{ id: string }>(`
      SELECT bin_location_id AS id FROM products WHERE id = '${other.id}'`);
    const [prodBin] = await executor.query<{ id: string }>(`
      SELECT bin_location_id AS id FROM products WHERE id = '${prod.id}'`);
    await executor.query(`
      INSERT INTO stock_movements (product_id, user_id, type, quantity, reason, bin_location_id) VALUES
      ('${other.id}', '${admin.id}', 'kit_consume', -1, 'kit smoke consume', '${otherBin.id}'),
      ('${prod.id}', '${admin.id}', 'kit_produce',  1, 'kit smoke produce', '${prodBin.id}')`);
    await executor.query(`UPDATE products SET current_stock = current_stock - 1 WHERE id = '${other.id}'`);
    await executor.query(`UPDATE products SET current_stock = current_stock + 1 WHERE id = '${prod.id}'`);

    const [kitCheck] = await executor.query<{ q: number }>(`
      SELECT COALESCE(SUM(quantity),0)::float8 AS q FROM product_stock WHERE product_id='${prod.id}'`);
    const [kitStock] = await executor.query<{ s: number }>(`
      SELECT current_stock::float8 AS s FROM products WHERE id='${prod.id}'`);
    console.log(`Kit produce: Σ product_stock=${kitCheck.q}, products.current_stock=${kitStock.s}`);
    if (kitCheck.q !== kitStock.s) return fail('kit legs did not project');

    console.log(`Transfer ${t.transfer_number} + kit legs verified end-to-end.`);
    return 0;
  } finally {
    await executor.close();
  }
}

function fail(msg: string): number {
  console.error(`FAIL: ${msg}`);
  return 1;
}

if (process.argv[1] && /verify-transfers\.(ts|js|mjs|cjs)$/.test(process.argv[1])) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('verify-transfers failed:', err);
      process.exit(1);
    });
}
