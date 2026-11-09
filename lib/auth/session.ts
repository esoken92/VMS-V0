/**
 * lib/auth/session — server-side session + authorization helpers.
 * These replace Supabase `auth.uid()` + RLS.
 *
 *   currentUser()      → CurrentAuth | null   (impersonation-aware)
 *   requireUser()      → CurrentAuth          (throws AuthError)
 *   requireRole(roles) → CurrentAuth          (throws AuthError)
 *   requirePermission  → CurrentAuth          (permission-matrix check)
 *   can(role, perm)    → boolean              (pure matrix check, re-export)
 *
 * Impersonation: when a super_admin "views as" another user, `user` is the
 * *effective* user (whose role gates permissions) and `actor` is the real
 * signed-in admin — `actor` is written to impersonated_by columns on writes.
 */

import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { authUsers, impersonationSessions, profiles } from '@/drizzle/schema';
import { AuthError } from '@/lib/result';
import { can, type Permission } from './permissions';
import { readImpersonationCookie } from './impersonation';
import type { UserRole } from './roles';
import type { ProfileDTO } from '@/lib/types';

export interface SessionUser {
  id: string;
  userId: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  alertLowStock: boolean;
  alertOverdueTools: boolean;
}

export interface CurrentAuth {
  /** Effective user — impersonation target when impersonating. */
  user: SessionUser;
  /** Real signed-in user. */
  actor: SessionUser;
  impersonating: boolean;
  impersonationSessionId: string | null;
}

export function toProfileDTO(u: SessionUser): ProfileDTO {
  return {
    id: u.id,
    user_id: u.userId,
    email: u.email,
    full_name: u.fullName,
    role: u.role,
    alert_low_stock: u.alertLowStock,
    alert_overdue_tools: u.alertOverdueTools,
    created_at: null,
  };
}

async function loadSessionUser(profileId: string): Promise<SessionUser | null> {
  const rows = await db
    .select({
      id: profiles.id,
      userId: profiles.userId,
      email: authUsers.email,
      fullName: profiles.fullName,
      role: profiles.role,
      alertLowStock: profiles.alertLowStock,
      alertOverdueTools: profiles.alertOverdueTools,
    })
    .from(profiles)
    .leftJoin(authUsers, eq(profiles.userId, authUsers.id))
    .where(eq(profiles.id, profileId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    email: r.email ?? null,
    fullName: r.fullName,
    role: r.role,
    alertLowStock: r.alertLowStock ?? true,
    alertOverdueTools: r.alertOverdueTools ?? true,
  };
}

export async function currentUser(): Promise<CurrentAuth | null> {
  const session = await auth();
  const authUserId = session?.user?.id;
  if (!authUserId) return null;

  // profiles.id == auth.users.id by convention; look up by id.
  const actor = await loadSessionUser(authUserId);
  if (!actor) return null;

  const base: CurrentAuth = {
    user: actor,
    actor,
    impersonating: false,
    impersonationSessionId: null,
  };

  const imp = await readImpersonationCookie();
  if (!imp || imp.iid !== actor.id) return base;

  // Cookie is only honored while the DB session row is still open.
  const rows = await db
    .select({
      id: impersonationSessions.id,
      targetUserId: impersonationSessions.targetUserId,
    })
    .from(impersonationSessions)
    .where(
      and(
        eq(impersonationSessions.id, imp.sid),
        eq(impersonationSessions.impersonatorId, actor.userId),
        isNull(impersonationSessions.endedAt),
      ),
    )
    .limit(1);

  const impSession = rows[0];
  if (!impSession) return base;

  const target = await loadSessionUser(imp.tid);
  if (!target || target.id !== impSession.targetUserId) return base;

  return {
    user: target,
    actor,
    impersonating: true,
    impersonationSessionId: impSession.id,
  };
}

export async function requireUser(): Promise<CurrentAuth> {
  const ctx = await currentUser();
  if (!ctx) throw new AuthError('UNAUTHENTICATED', 'Not authenticated');
  return ctx;
}

export async function requireRole(roles: UserRole[]): Promise<CurrentAuth> {
  const ctx = await requireUser();
  if (!roles.includes(ctx.user.role)) {
    throw new AuthError('FORBIDDEN', 'Insufficient permissions');
  }
  return ctx;
}

export async function requirePermission(permission: Permission): Promise<CurrentAuth> {
  const ctx = await requireUser();
  if (!can(ctx.user.role, permission)) {
    throw new AuthError('FORBIDDEN', 'Insufficient permissions');
  }
  return ctx;
}

export { can };
export type { Permission };
