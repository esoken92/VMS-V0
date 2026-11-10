import { withApi } from '@/lib/api/handler';
import { apiJson, parseJsonBody } from '@/lib/api/http';
import { apiListProducts, apiUpsertProduct } from '@/lib/api/data';
import { productListQuery, upsertProductBody } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/v1/products — list/search the catalog. `read` scope. */
export const GET = withApi('read', async (req, principal) => {
  const query = productListQuery.parse({
    q: req.nextUrl.searchParams.get('q') ?? undefined,
    item_type: req.nextUrl.searchParams.get('item_type') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    offset: req.nextUrl.searchParams.get('offset') ?? undefined,
  });
  const items = await apiListProducts(principal, {
    query: query.q,
    itemType: query.item_type,
    limit: query.limit,
    offset: query.offset,
  });
  return apiJson({ data: items });
});

/** POST /api/v1/products — create a product. `write` scope + products:write. */
export const POST = withApi('write', async (req, principal) => {
  const body = upsertProductBody.parse(await parseJsonBody(req));
  const product = await apiUpsertProduct(principal, {
    sku: body.sku,
    name: body.name,
    itemType: body.item_type,
    currentStock: body.current_stock,
    minThreshold: body.min_threshold,
    averageCost: body.average_cost,
    unitOfMeasure: body.unit_of_measure,
    issuingUnit: body.issuing_unit,
    supplierId: body.supplier_id,
    binLocationId: body.bin_location_id,
  });
  return apiJson({ data: product }, { status: 201 });
});
