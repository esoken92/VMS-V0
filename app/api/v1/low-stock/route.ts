import { withApi } from '@/lib/api/handler';
import { apiJson } from '@/lib/api/http';
import { apiListStockLevels } from '@/lib/api/data';

export const dynamic = 'force-dynamic';

/** GET /api/v1/low-stock — products at or below min_threshold. `read` scope. */
export const GET = withApi('read', async (_req, principal) => {
  const items = await apiListStockLevels(principal, { onlyLow: true });
  return apiJson({ data: items });
});
