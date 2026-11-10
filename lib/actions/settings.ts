'use server';

import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { systemSettings } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requirePermission } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import type { SystemSettingDTO } from '@/lib/types';

export async function listSettings(): Promise<Result<SystemSettingDTO[]>> {
  try {
    await requirePermission('system_settings:read');
    const rows = await db
      .select({
        key: systemSettings.key,
        value: systemSettings.value,
        category: systemSettings.category,
        description: systemSettings.description,
        updated_at: systemSettings.updatedAt,
      })
      .from(systemSettings)
      .orderBy(asc(systemSettings.key));
    return ok(
      rows.map((r) => ({ ...r, updated_at: r.updated_at?.toISOString() ?? null })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const updateSchema = z.object({
  entries: z.record(z.string().min(1).max(200), z.string().max(5000)),
});

/** Upsert settings entries (key → value) — ports update_system_setting (005). */
export async function updateSettings(input: unknown): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('system_settings:write');
    const data = updateSchema.parse(input);

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      for (const [key, value] of Object.entries(data.entries)) {
        await tx
          .insert(systemSettings)
          .values({ key, value, updatedBy: ctx.actor.id })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value, updatedBy: ctx.actor.id, updatedAt: new Date() },
          });
      }
    });

    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
