import { withApi } from '@/lib/api/handler';
import { apiJson } from '@/lib/api/http';
import { apiGetTakeItems, apiListTakes, apiStartTake } from '@/lib/api/data';
import { startTakeBody, uuidSchema } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/takes — stock takes with live progress.
 * Pass ?id=<uuid> to fetch one take's counted items instead.
 */
export const GET = withApi('read', async (req, principal) => {
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const takeId = uuidSchema.parse(id);
    const items = await apiGetTakeItems(principal, takeId);
    return apiJson({ data: items });
  }
  const items = await apiListTakes(principal, {});
  return apiJson({ data: items });
});

/** POST /api/v1/takes — open a new stock take. `write` scope + stock_takes:write. */
export const POST = withApi('write', async (req, principal) => {
  const body = startTakeBody.parse(await req.json().catch(() => ({})));
  const result = await apiStartTake(principal, { notes: body.notes });
  return apiJson({ data: result }, { status: 201 });
});
