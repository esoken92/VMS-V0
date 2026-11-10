import { withApi } from '@/lib/api/handler';
import { apiJson, parseJsonBody } from '@/lib/api/http';
import { apiCreateMovement, apiListMovements } from '@/lib/api/data';
import { createMovementBody, movementListQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/movements — the ledger, newest first.
 * Roles without stock_movements:read:all see only their own rows.
 * Filters: ?product_id=, ?days=, ?limit= (max 200).
 */
export const GET = withApi('read', async (req, principal) => {
  const query = movementListQuery.parse({
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    product_id: req.nextUrl.searchParams.get('product_id') ?? undefined,
    days: req.nextUrl.searchParams.get('days') ?? undefined,
  });
  const items = await apiListMovements(principal, query);
  return apiJson({ data: items });
});

/**
 * POST /api/v1/movements — append a ledger row (inbound/outbound/
 * adjustment/scrap/receiving). `write` scope; the role matrix still
 * restricts which movement types each role may record.
 */
export const POST = withApi('write', async (req, principal) => {
  const body = createMovementBody.parse(await parseJsonBody(req));
  const result = await apiCreateMovement(principal, {
    productId: body.product_id,
    sku: body.sku,
    type: body.type,
    quantity: body.quantity,
    reason: body.reason,
    scrapImageUrl: body.scrap_image_url,
  });
  return apiJson({ data: result }, { status: 201 });
});
