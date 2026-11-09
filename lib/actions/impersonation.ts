'use server';

import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authUsers, impersonationSessions, profiles } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser } from '@/lib/auth/session';
import {
  clearImpersonationCookie,
  setImpersonationCookie,
} from '@/lib/auth/impersonation';
import { actionError, fail, ok, type Result } from '@/lib/result';
import type { ImpersonatableUserDTO } from '@/lib/types';

/**
 * Impersonation — ports the 008 RPCs (get_impersonatable_users,
 * start_impersonation_session, end_impersonation_session) plus the
 * set_config session flag into app-layer logic: a real
 * impersonation_sessions row + a signed httpOnly cookie consumed by
 * currentUser().
 */
export async function listImpersonatableUsers(): Promise<
  Result<ImpersonatableUserDTO[]>
> {
  try {
    const ctx = await requireUser();
    if (ctx.actor.role !== 'super_admin') {
      return fail('Only super admins can impersonate', 'FORBIDDEN');
    }
    const rows = await db
      .select({
        id: profiles.id,
        full_name: profiles.fullName,
        role: profiles.role,
        email: authUsers.email,
      })
      .from(profiles)
      .leftJoin(authUsers, eq(profiles.userId, authUsers.id))
      .orderBy(asc(profiles.fullName));
    return ok(rows.filter((r) => r.role !== 'super_admin'));
  } catch (err) {
    return actionError(err);
  }
}

const startSchema = z.object({
  target_user_id: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});

export async function startImpersonation(input: unknown): Promise<
  Result<{ session_id: string }>
> {
  try {
    const ctx = await requireUser();
    if (ctx.actor.role !== 'super_admin') {
      return fail('Only super admins can impersonate', 'FORBIDDEN');
    }
    const data = startSchema.parse(input);

    const [target] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, data.target_user_id))
      .limit(1);
    if (!target) return fail('Target user not found', 'NOT_FOUND');
    if (target.role === 'super_admin') {
      return fail('Cannot impersonate a super admin', 'FORBIDDEN');
    }
    if (target.id === ctx.actor.id) return fail('Cannot impersonate yourself', 'FORBIDDEN');

    const session = await db.transaction(async (tx) => {
      await setAuditContext(tx, { userId: ctx.actor.id, impersonatorId: null });
      const [s] = await tx
        .insert(impersonationSessions)
        .values({
          impersonatorId: ctx.actor.userId,
          targetUserId: target.userId,
          reason: data.reason || null,
        })
        .returning({ id: impersonationSessions.id });
      return s;
    });

    await setImpersonationCookie({
      sid: session.id,
      iid: ctx.actor.id,
      iname: ctx.actor.fullName,
      tid: target.id,
      trole: target.role,
      tname: target.fullName,
    });

    return ok({ session_id: session.id });
  } catch (err) {
    return actionError(err);
  }
}

export async function endImpersonation(): Promise<Result<null>> {
  try {
    const ctx = await requireUser();
    if (!ctx.impersonating || !ctx.impersonationSessionId) {
      return ok(null); // nothing to end — idempotent
    }
    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.actor.id,
        impersonatorId: null,
      });
      await tx
        .update(impersonationSessions)
        .set({ endedAt: new Date() })
        .where(eq(impersonationSessions.id, ctx.impersonationSessionId as string));
    });
    await clearImpersonationCookie();
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
