'use server';

import { z } from 'zod';
import { requireUser, can } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import { getDataset, listDatasetMetas, ROW_CAP } from '@/lib/reports/datasets';
import type { CustomReportResultDTO, ReportDatasetMetaDTO } from '@/lib/types';

/**
 * Custom report builder (roadmap 2o): the client picks a dataset + filters,
 * the registry runs ONE bounded query, and the result renders as a table
 * that can export to CSV (client) or PDF (api/reports/custom → Typst).
 * Per-dataset permission gate — the audit log needs activity_logs:read.
 */

export async function listReportDatasets(): Promise<Result<ReportDatasetMetaDTO[]>> {
  try {
    const ctx = await requireUser();
    const visible = listDatasetMetas()
      .filter((d) => can(ctx.user.role, d.permission))
      .map((d) => ({
        id: d.id,
        label: d.label,
        description: d.description,
        columns: d.columns,
        filters: d.filters,
      }));
    return ok(visible);
  } catch (err) {
    return actionError(err);
  }
}

const runSchema = z.object({
  dataset: z.string().min(1).max(64),
  filters: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional(),
});

export async function runReport(input: unknown): Promise<Result<CustomReportResultDTO>> {
  try {
    const ctx = await requireUser();
    const data = runSchema.parse(input);

    const ds = getDataset(data.dataset);
    if (!ds) return fail('Unknown dataset', 'NOT_FOUND');
    if (!can(ctx.user.role, ds.permission)) {
      return fail(`Your role cannot run the ${ds.label} report`, 'FORBIDDEN');
    }

    // Only declared filter keys reach the loader — no free-form input.
    const filters: Record<string, string | number> = {};
    for (const f of ds.filters) {
      const v = data.filters?.[f.key];
      if (v === undefined || v === '') continue;
      if (f.type === 'select' && f.options?.length) {
        const allowed = f.options.map((o) => o.value);
        if (!allowed.includes(String(v))) continue;
      }
      filters[f.key] = v;
    }

    const rows = await ds.run(filters);
    return ok({
      dataset: ds.id,
      label: ds.label,
      columns: ds.columns,
      rows,
      row_count: rows.length,
      capped: rows.length >= ROW_CAP,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return actionError(err);
  }
}
