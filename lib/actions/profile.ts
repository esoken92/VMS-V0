'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { profiles } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';

const updateSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
});

export async function updateMyProfile(input: unknown): Promise<Result<null>> {
  try {
    const ctx = await requireUser();
    const data = updateSchema.parse(input);
    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx
        .update(profiles)
        .set({ fullName: data.full_name })
        .where(eq(profiles.id, ctx.user.id));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}

const alertPrefsSchema = z.object({
  alert_low_stock: z.boolean(),
  alert_overdue_tools: z.boolean(),
});

/** Alert preferences added by migration 009. */
export async function updateMyAlertPrefs(input: unknown): Promise<Result<null>> {
  try {
    const ctx = await requireUser();
    const data = alertPrefsSchema.parse(input);
    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx
        .update(profiles)
        .set({
          alertLowStock: data.alert_low_stock,
          alertOverdueTools: data.alert_overdue_tools,
        })
        .where(eq(profiles.id, ctx.user.id));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
