import { withApi } from '@/lib/api/handler';
import { apiJson, parseJsonBody } from '@/lib/api/http';
import { apiGetProduct, apiUpsertProduct } from '@/lib/api/data';
import { upsertProductBody, uuidSchema } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

const patchBody = upsertProductBody.partial();

/** GET /api/v1/products/{id} — id or SKU. `read` scope. */
export const GET = withApi('read', async (_req, principal, ctx) => {
  const product = await apiGetProduct(principal, ctx.params.id);
  return apiJson({ data: product });
});

/** PATCH /api/v1/products/{id} — partial update. `write` scope. */
export const PATCH = withApi('write', async (req, principal, ctx) => {
  const id = uuidSchema.parse(ctx.params.id);
  const raw = patchBody.parse(await parseJsonBody(req));

  // PATCH semantics: merge onto the existing row.
  const existing = await apiGetProduct(principal, id);
  const product = await apiUpsertProduct(principal, {
    id,
    sku: raw.sku ?? existing.sku,
    name: raw.name ?? existing.name,
    itemType: raw.item_type ?? existing.item_type,
    currentStock: raw.current_stock,
    minThreshold: raw.min_threshold ?? existing.min_threshold,
    averageCost: raw.average_cost ?? existing.average_cost,
    unitOfMeasure: raw.unit_of_measure ?? existing.unit_of_measure,
    issuingUnit: raw.issuing_unit ?? existing.issuing_unit,
    supplierId: raw.supplier_id !== undefined ? raw.supplier_id : existing.supplier_id,
    binLocationId:
      raw.bin_location_id !== undefined ? raw.bin_location_id : existing.bin_location_id,
  });
  return apiJson({ data: product });
});
