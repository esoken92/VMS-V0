import { withApi } from '@/lib/api/handler';
import { apiJson } from '@/lib/api/http';
import { apiListAudit } from '@/lib/api/data';
import { auditListQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit — activity log. Requires the `admin` key scope AND an
 * admin/super_admin role (same gate as /dashboard/audit-log). ?limit=500 max.
 */
export const GET = withApi('admin', async (req, principal) => {
  const query = auditListQuery.parse({
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  const items = await apiListAudit(principal, { limit: query.limit });
  return apiJson({ data: items });
});
