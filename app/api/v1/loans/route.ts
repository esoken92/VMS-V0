import { withApi } from '@/lib/api/handler';
import { apiJson, parseJsonBody } from '@/lib/api/http';
import { apiCheckoutTools, apiCheckinTools, apiListLoans } from '@/lib/api/data';
import { checkinLoanBody, checkoutLoanBody, loanListQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/loans — tool custody. Roles without tool_loans:read:all see
 * only loans they hold. Filters: ?active_only=1, ?limit=.
 */
export const GET = withApi('read', async (req, principal) => {
  const query = loanListQuery.parse({
    active_only: req.nextUrl.searchParams.get('active_only') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  const items = await apiListLoans(principal, {
    activeOnly: query.active_only,
    limit: query.limit,
  });
  return apiJson({ data: items });
});

/**
 * POST /api/v1/loans — check out tools. Body:
 *   { tool_product_ids?|tool_skus?, worker_profile_id?,
 *     expected_return_at?, condition_on_checkout, notes? }
 * Checking out for another worker requires tool_loans:create:for_other.
 *
 * POST /api/v1/loans?action=return — return tools. Body:
 *   { loan_ids?|tool_product_id?|tool_sku?, condition_on_return }
 */
export const POST = withApi('write', async (req, principal) => {
  const action = req.nextUrl.searchParams.get('action');

  if (action === 'return') {
    const body = checkinLoanBody.parse(await parseJsonBody(req));
    const result = await apiCheckinTools(principal, {
      loanIds: body.loan_ids,
      toolProductId: body.tool_product_id,
      toolSku: body.tool_sku,
      conditionOnReturn: body.condition_on_return,
    });
    return apiJson({ data: result });
  }

  const body = checkoutLoanBody.parse(await parseJsonBody(req));
  const result = await apiCheckoutTools(principal, {
    toolIds: body.tool_product_ids,
    toolSkus: body.tool_skus,
    workerProfileId: body.worker_profile_id,
    expectedReturnAt: body.expected_return_at,
    conditionOnCheckout: body.condition_on_checkout,
    notes: body.notes,
  });
  return apiJson({ data: result }, { status: 201 });
});
