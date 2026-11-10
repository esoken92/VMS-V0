import { withApi } from '@/lib/api/handler';
import { apiJson } from '@/lib/api/http';
import { apiListStockLevels } from '@/lib/api/data';
import { boolParam } from '@/lib/api/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const stockQuery = z.object({
  product_id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  only_low: boolParam,
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

/** GET /api/v1/stock — on-hand levels. Filter: ?product_id=, ?sku=, ?only_low=1 */
export const GET = withApi('read', async (req, principal) => {
  const query = stockQuery.parse({
    product_id: req.nextUrl.searchParams.get('product_id') ?? undefined,
    sku: req.nextUrl.searchParams.get('sku') ?? undefined,
    only_low: req.nextUrl.searchParams.get('only_low') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });

  const levels = await apiListStockLevels(principal, {
    onlyLow: query.only_low,
    limit: query.limit,
  });

  const filtered = levels.filter(
    (l) =>
      (!query.product_id || l.product_id === query.product_id) &&
      (!query.sku || l.sku === query.sku),
  );
  return apiJson({ data: filtered });
});
