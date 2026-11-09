'use server';

import argon2 from 'argon2';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authUsers, profiles } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requirePermission, can } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import { USER_ROLES } from '@/lib/auth/roles';
import type { UserListItemDTO } from '@/lib/types';

/**
 * User management — ports the 008 RPCs (get_all_users,
 * create_user_with_profile, update_user_role, delete_user) plus the
 * update-profile path into app-layer transactions. super_admin-only perms
 * live in the permission matrix; granting super_admin itself needs
 * `users:grant_super_admin`.
 */
export async function listUsers(): Promise<Result<UserListItemDTO[]>> {
  try {
    await requirePermission('users:read');
    const rows = await db
      .select({
        id: profiles.id,
        full_name: profiles.fullName,
        role: profiles.role,
        email: authUsers.email,
        last_sign_in_at: authUsers.lastSignInAt,
        created_at: profiles.createdAt,
        password_hash: profiles.passwordHash,
      })
      .from(profiles)
      .innerJoin(authUsers, eq(profiles.id, authUsers.id))
      .orderBy(asc(profiles.createdAt));

    return ok(
      rows.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        role: r.role,
        email: r.email,
        has_password: r.password_hash !== null && r.password_hash.length > 0,
        last_sign_in_at: r.last_sign_in_at?.toISOString() ?? null,
        created_at: r.created_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const createSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(6, 'Password must be at least 6 characters').max(200),
  full_name: z.string().trim().min(2).max(200),
  role: z.enum(USER_ROLES),
});

export async function createUser(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requirePermission('users:create');
    const data = createSchema.parse(input);
    if (data.role === 'super_admin' && !can(ctx.user.role, 'users:grant_super_admin')) {
      return fail('Only a super admin can create another super admin', 'FORBIDDEN');
    }
    const email = data.email.toLowerCase().trim();

    const existing = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);
    if (existing.length > 0) return fail('A user with this email already exists', 'CONFLICT');

    const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });

    const created = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [u] = await tx
        .insert(authUsers)
        .values({ email, emailConfirmedAt: new Date() })
        .returning({ id: authUsers.id });
      await tx.insert(profiles).values({
        id: u.id,
        userId: u.id,
        fullName: data.full_name,
        role: data.role,
        passwordHash,
      });
      return u;
    });

    return ok({ id: created.id });
  } catch (err) {
    return actionError(err);
  }
}

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(200).optional(),
  role: z.enum(USER_ROLES).optional(),
});

export async function updateUser(input: unknown): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('users:update');
    const data = updateSchema.parse(input);

    const [target] = await db
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, data.user_id))
      .limit(1);
    if (!target) return fail('User not found', 'NOT_FOUND');

    // Guardrails: super_admin role changes (both granting and revoking a
    // super_admin's own role) are reserved for users:grant_super_admin.
    const grant = can(ctx.user.role, 'users:grant_super_admin');
    if (!grant && (target.role === 'super_admin' || data.role === 'super_admin')) {
      return fail('Only a super admin can change super admin roles', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx
        .update(profiles)
        .set({
          ...(data.full_name !== undefined ? { fullName: data.full_name } : {}),
          ...(data.role !== undefined ? { role: data.role } : {}),
        })
        .where(eq(profiles.id, data.user_id));
    });

    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteUser(id: string): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('users:delete');
    const targetId = z.string().uuid().parse(id);
    if (targetId === ctx.user.id) {
      return fail('You cannot delete your own account', 'FORBIDDEN');
    }

    const [target] = await db
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, targetId))
      .limit(1);
    if (!target) return fail('User not found', 'NOT_FOUND');
    if (target.role === 'super_admin' && !can(ctx.user.role, 'users:grant_super_admin')) {
      return fail('Only a super admin can delete a super admin', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      // profiles + all related rows cascade from auth.users
      await tx.delete(authUsers).where(eq(authUsers.id, targetId));
    });

    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
