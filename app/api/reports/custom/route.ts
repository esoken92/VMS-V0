/**
 * POST /api/reports/custom — Typst-rendered PDF for any builder dataset.
 *
 * Security: the route re-runs the dataset server-side — client-supplied
 * rows are NEVER trusted. Filters are whitelisted to the dataset's declared
 * keys (same as runReport). Session-auth + the dataset's own permission.
 */

import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { systemSettings } from '@/drizzle/schema';
import { requireUser, can } from '@/lib/auth/session';
import { AuthError } from '@/lib/result';
import { apiError, apiErrorResponse } from '@/lib/api/http';
import { getDataset, ROW_CAP } from '@/lib/reports/datasets';
import { renderGenericTablePdf } from '@/lib/pdf/templates/generic-table';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  dataset: z.string().min(1).max(64),
  filters: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireUser();
    const data = bodySchema.parse(await req.json());

    const ds = getDataset(data.dataset);
    if (!ds) return apiError('not_found', 'Unknown dataset');
    if (!can(ctx.user.role, ds.permission)) {
      return apiError('forbidden', `Your role cannot export the ${ds.label} report`);
    }

    const filters: Record<string, string | number> = {};
    for (const f of ds.filters) {
      const v = data.filters?.[f.key];
      if (v === undefined || v === '') continue;
      if (f.type === 'select' && f.options?.length && !f.options.some((o) => o.value === String(v))) {
        continue;
      }
      filters[f.key] = v;
    }

    const [rows, settingsRows] = await Promise.all([
      ds.run(filters),
      db
        .select({ v: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, 'company_name'))
        .limit(1),
    ]);
    const orgName = settingsRows[0]?.v?.trim() || 'VMS Inventory';

    const filterText = Object.entries(filters)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');

    const pdf = await renderGenericTablePdf({
      orgName,
      title: ds.label,
      subtitle: filterText
        ? `${ds.description} — Filters: ${filterText}`
        : ds.description,
      generatedAt: format(new Date(), 'd MMM yyyy, HH:mm'),
      columns: ds.columns.map((c) => c.label),
      rows: rows
        .slice(0, ROW_CAP)
        .map((r) => ds.columns.map((c) => String(r[c.key] ?? '—'))),
    });

    const filename = `${ds.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(
        err.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'forbidden',
        err.code === 'UNAUTHENTICATED' ? 'Not authenticated' : 'Forbidden',
      );
    }
    return apiErrorResponse(err);
  }
}
